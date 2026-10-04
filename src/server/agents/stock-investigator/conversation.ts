import { generateText, isStepCount, tool, type ToolSet } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { splitBlocksFromAnswer } from "../../../lib/conversation-view-model.ts";
import { INVESTIGATION_DISCLAIMER } from "../../../shared/schemas/investigation.ts";
import { synthesizerModel } from "../../ai/gateway.ts";
import type {
  ConversationRecord,
  InvestigationDetail,
  InvestigationStore,
} from "../../db/investigations.ts";
import { createSectorsMcpClient } from "../../sectors/mcp.ts";
import type { ToolDefinition } from "../../tools/index.ts";
import { sectorsInvestigationTools } from "../../tools/sectors.ts";
import { toPlainAnswer } from "./answer-format.ts";
import { OUTPUT_LANGUAGE_INSTRUCTION } from "./llm.ts";
import {
  EvidenceItemSchema,
  ToolCallRecordSchema,
  type EvidenceItem,
  type ToolCallRecord,
} from "./schemas.ts";
export type InvestigationConversationInput = {
  readonly investigation: InvestigationDetail;
  readonly message: string;
  readonly signal?: AbortSignal;
};

export type InvestigationConversationResult = {
  readonly message: ConversationRecord;
  readonly toolCalls: readonly ToolCallRecord[];
};

/**
 * House style for follow-up answers. The chat renders plain text, and answers
 * should read like a short analyst note rather than a generated report.
 */
export const FOLLOW_UP_STYLE_INSTRUCTION = [
  "Answer style:",
  "Open with one sentence that answers the question directly. No preamble, no restating the question, no headings.",
  "Then give at most four short supporting points, each on its own line starting with '- '. Each point names the date or period and the figure from the evidence or tool data.",
  "Optionally end with one line that starts with 'Pantau: ' naming what to watch next.",
  "Keep the whole answer under 120 words. Leave out anything that does not help answer the question.",
  "Plain text only in the prose: no markdown headings, tables, bold, italics, code formatting, or emoji. Do not use em dashes or en dashes; use commas or periods.",
  "Structure belongs in the attached uiBlocks, not in the prose. Attach a block only when the evidence supports it, and never invent a figure for one.",
  "Write like a calm analyst: plain words, no hype, no dramatic phrasing.",
  "Do not call the stock bullish or bearish, and do not predict price levels or direction. Describe what the data shows and what to monitor.",
  "If data for part of the question is unavailable, say so in one short sentence.",
].join(" ");

const McpToolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

const McpToolResultSchema = z.object({
  toolCallId: z.string().optional(),
  output: z.unknown().optional(),
});

export async function runInvestigationConversation(
  input: InvestigationConversationInput,
  store: InvestigationStore,
): Promise<InvestigationConversationResult> {
  await store.appendConversation(input.investigation.id, "user", input.message);

  const { tools, close } = await resolveConversationTools(input.investigation);

  try {
    const response = await generateText({
      model: synthesizerModel,
      system: [
        "You answer a scoped follow-up about one Indonesian stock investigation.",
        "Use the supplied investigation evidence first; call the approved Sectors tools only when current or missing evidence is needed.",
        "Never invent data, never hide unavailable data, and never produce BUY, SELL, or HOLD advice.",
        "Do not expose private reasoning. Return a concise evidence-grounded answer and state uncertainty.",
        FOLLOW_UP_STYLE_INSTRUCTION,
        UI_BLOCK_INSTRUCTION,
        OUTPUT_LANGUAGE_INSTRUCTION,
        INVESTIGATION_DISCLAIMER,
      ].join(" "),
      prompt: JSON.stringify({
        ticker: input.investigation.ticker,
        originalQuestion: input.investigation.question,
        currentInvestigation: {
          status: input.investigation.status,
          driver: input.investigation.driver,
          classification: input.investigation.classification,
          confidence: input.investigation.confidence,
          signals: input.investigation.signals,
          explanation: input.investigation.explanation,
          evidence: input.investigation.evidence?.map(summarizeEvidence),
        },
        conversation: input.investigation.conversations?.slice(-12),
        followUp: input.message,
      }),
      tools,
      stopWhen: isStepCount(4),
      maxRetries: 1,
      abortSignal: input.signal,
    });

    const { prose, blocks } = splitBlocksFromAnswer(response.text);

    const answer = toPlainAnswer(prose);
    if (!answer) throw new Error("Conversation model returned an empty response");

    const toolCalls = collectMcpToolCalls(response.toolCalls, response.toolResults);
    if (toolCalls.length > 0) await store.appendToolCalls(input.investigation.id, toolCalls);

    const evidence = collectMcpEvidence(toolCalls);
    if (evidence.length > 0) await store.appendEvidence(input.investigation.id, evidence);

    const assistantMessage = await store.appendConversation(
      input.investigation.id,
      "assistant",
      answer,
      blocks.length > 0 ? blocks : undefined,
    );
    return { message: assistantMessage, toolCalls };
  } finally {
    await close();
  }
}

/** Prefers Sectors MCP when reachable, otherwise falls back to the REST tools. */
async function resolveConversationTools(
  investigation: InvestigationDetail,
): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
  try {
    const mcpClient = await createSectorsMcpClient();
    const tools = exposeUnderscoredToolNames((await mcpClient.tools()) as ToolSet);
    return { tools, close: () => mcpClient.close() };
  } catch (error) {
    console.warn(
      `[sector-context-agent] Sectors MCP unavailable for follow-up, using REST tools: ${errorMessage(error)}`,
    );
    return {
      tools: createRestConversationTools(investigation),
      close: async () => undefined,
    };
  }
}

/**
 * Exposes the application-owned Sectors REST tools to a follow-up conversation.
 *
 * The ticker is fixed by the investigation, so the model cannot widen the scope.
 */
function createRestConversationTools(investigation: InvestigationDetail): ToolSet {
  const ticker = investigation.ticker ?? "";
  const tools: ToolSet = {};
  const definitions: readonly ToolDefinition[] = sectorsInvestigationTools;
  for (const definition of definitions) {
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async (input: unknown) => {
        const parsed = definition.inputSchema.safeParse(input);
        if (!parsed.success) {
          return {
            ok: false,
            error: {
              code: "INVALID_TOOL_INPUT",
              message: parsed.error.issues.map((issue) => issue.message).join("; "),
            },
          };
        }
        try {
          const result = await definition.execute(parsed.data, {
            ticker,
            investigationId: investigation.id,
          });
          return { ok: true, data: result.value };
        } catch (error) {
          return {
            ok: false,
            error: { code: "TOOL_EXECUTION_FAILED", message: errorMessage(error) },
          };
        }
      },
    });
  }
  return tools;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Gemini rejects dashes in function names and answers with underscores, so
 * expose MCP tool names in underscore form; `execute` still calls the original
 * MCP tool.
 */
function exposeUnderscoredToolNames(tools: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name.replaceAll("-", "_"), tool]),
  );
}

function summarizeEvidence(item: EvidenceItem): Record<string, unknown> {
  return {
    type: item.type,
    source: item.source,
    summary: item.summary,
    payload: item.payload === undefined ? undefined : JSON.stringify(item.payload).slice(0, 4_000),
  };
}

function collectMcpToolCalls(
  calls: readonly unknown[],
  results: readonly unknown[],
): ToolCallRecord[] {
  return calls.flatMap((call) => {
    const parsedCall = McpToolCallSchema.safeParse(call);
    if (!parsedCall.success) return [];
    const matchingResult = results
      .map((result) => McpToolResultSchema.safeParse(result))
      .find(
        (result) =>
          result.success &&
          parsedCall.data.toolCallId !== undefined &&
          result.data.toolCallId === parsedCall.data.toolCallId,
      );
    return [
      ToolCallRecordSchema.parse({
        id: randomUUID(),
        toolName: `mcp:${parsedCall.data.toolName}`,
        status: "succeeded",
        reason: "Scoped follow-up evidence",
        input: parsedCall.data.input,
        output: matchingResult?.success ? matchingResult.data.output : undefined,
      }),
    ];
  });
}

function collectMcpEvidence(toolCalls: readonly ToolCallRecord[]): EvidenceItem[] {
  return toolCalls.map((toolCall) =>
    EvidenceItemSchema.parse({
      id: randomUUID(),
      type: evidenceType(toolCall.toolName),
      source: toolCall.toolName,
      summary: `Sectors returned follow-up evidence for ${toolCall.toolName.replace(/^mcp:/, "")}.`,
      payload: toolCall.output,
      collectedAt: new Date().toISOString(),
    }),
  );
}

function evidenceType(toolName: string): EvidenceItem["type"] {
  const normalized = toolName.toLowerCase();
  if (normalized.includes("foreign")) return "foreign_flow";
  if (normalized.includes("broker")) return "broker";
  if (normalized.includes("news")) return "news";
  if (normalized.includes("filing")) return "filing";
  if (normalized.includes("sector")) return "sector";
  if (normalized.includes("market") || normalized.includes("index")) return "market";
  if (normalized.includes("price") || normalized.includes("daily")) return "price_volume";
  return "company";
}

/**
 * The closed block vocabulary, described for the model.
 *
 * The model picks from this list; it never authors components. Anything it
 * returns outside the list is dropped by `parseUiBlocks`.
 */
export const UI_BLOCK_INSTRUCTION = [
  "After the prose, you may attach structured blocks for visualisation.",
  'Append them as a single line of JSON in the form {"blocks":[ ... ]} on its own line at the very end.',
  "Allowed block types, and nothing else:",
  '{"type":"metric","label":string,"value":string,"change"?:string,"direction"?:"up"|"down"|"flat"}',
  '{"type":"comparison","title":string,"rows":[{"label":string,"value":string,"note"?:string}]}',
  '{"type":"series","title":string,"unit"?:string,"points":[{"date":string,"value":number}]}',
  '{"type":"driver","driver":"MARKET_DRIVEN"|"SECTOR_DRIVEN"|"FLOW_DRIVEN"|"COMPANY_SPECIFIC"|"MIXED"|"UNCLEAR","confidence":"HIGH"|"MEDIUM"|"LOW"}',
  '{"type":"sources","items":[{"label":string,"detail"?:string}]}',
  "Every figure in a block must come from the supplied evidence or tool data. If nothing fits, omit the line entirely.",
].join(" ");
