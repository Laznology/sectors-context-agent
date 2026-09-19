import { generateText, isStepCount, type ToolSet } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { synthesizerModel } from "../../ai/gateway.ts";
import type {
  ConversationRecord,
  InvestigationDetail,
  InvestigationStore,
} from "../../db/investigations.ts";
import { createSectorsMcpClient } from "../../sectors/mcp.ts";
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
  const mcpClient = await createSectorsMcpClient();

  try {
    const tools = exposeUnderscoredToolNames((await mcpClient.tools()) as ToolSet);
    const response = await generateText({
      model: synthesizerModel,
      system: [
        "You answer a scoped follow-up about one Indonesian stock investigation.",
        "Use the supplied investigation evidence first; use approved Sectors MCP tools only when current or missing evidence is needed.",
        "Never invent data, never hide unavailable data, and never produce BUY, SELL, or HOLD advice.",
        "Do not expose private reasoning. Return a concise evidence-grounded answer and state uncertainty.",
        "This analysis is informational and does not constitute investment advice.",
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

    const answer = response.text.trim();
    if (!answer) throw new Error("Conversation model returned an empty response");

    const toolCalls = collectMcpToolCalls(response.toolCalls, response.toolResults);
    if (toolCalls.length > 0) await store.appendToolCalls(input.investigation.id, toolCalls);

    const evidence = collectMcpEvidence(toolCalls);
    if (evidence.length > 0) await store.appendEvidence(input.investigation.id, evidence);

    const assistantMessage = await store.appendConversation(
      input.investigation.id,
      "assistant",
      answer,
    );
    return { message: assistantMessage, toolCalls };
  } finally {
    await mcpClient.close();
  }
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
      summary: `Sectors MCP returned follow-up evidence for ${toolCall.toolName.replace(/^mcp:/, "")}.`,
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
