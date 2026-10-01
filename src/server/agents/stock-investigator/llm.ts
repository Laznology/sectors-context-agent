import { generateObject } from "ai";
import { z } from "zod";
import { INVESTIGATION_DISCLAIMER } from "../../../shared/schemas/investigation.ts";
import { plannerModel, synthesizerModel } from "../../ai/gateway.ts";
import type { PlannerInput, SynthesizerInput } from "./graph.ts";
import {
  InvestigationPlanSchema,
  InvestigationResultSchema,
  type InvestigationPlan,
  type InvestigationResult,
} from "./schemas.ts";

/**
 * Model retries for the structured-output calls.
 *
 * A malformed JSON response used to fail the whole investigation after every
 * Sectors credit was already spent, and it happened intermittently with a
 * healthy gateway. Two retries cover a bad completion; the prompt is unchanged
 * so a retry is not a different request, just another sample.
 */
const MODEL_MAX_RETRIES = Number(process.env.MODEL_MAX_RETRIES ?? 2);

/**
 * The product's audience is Indonesian retail investors, so every user-facing
 * string the model writes must be in Bahasa Indonesia. Identifiers, enum values,
 * tool names, JSON keys, and numbers stay as-is so structured output still
 * validates.
 */
export const OUTPUT_LANGUAGE_INSTRUCTION =
  "Write every user-facing string in Bahasa Indonesia (Indonesian). " +
  "Keep identifiers, enum values, tool names, JSON keys, and numbers unchanged.";

/**
 * Appends the required response shape to a prompt.
 *
 * `generateObject` sends the schema through the request's `response_format` and
 * does not put it in the prompt. OpenAI-compatible gateways that ignore
 * `response_format` (they answer with prose) therefore fail to parse. Spelling
 * the JSON contract out in the prompt makes the model produce valid JSON even
 * when the gateway drops `response_format`; a gateway that enforces it simply
 * sees the same shape twice.
 */
export function withJsonContract(schema: z.ZodType, lines: readonly string[]): string {
  return [
    ...lines,
    "Respond with ONLY a single valid JSON object that matches this JSON Schema.",
    "Do not wrap it in markdown fences and do not add prose before or after it.",
    JSON.stringify(z.toJSONSchema(schema)),
  ].join("\n");
}

export async function planWithModel(
  input: PlannerInput,
  tools: readonly { name: string; description: string }[],
): Promise<InvestigationPlan> {
  const { object } = await generateObject({
    model: plannerModel,
    schema: InvestigationPlanSchema,
    maxRetries: MODEL_MAX_RETRIES,
    prompt: withJsonContract(InvestigationPlanSchema, [
      "You are the planning stage of an auditable Indonesian stock investigation.",
      "Choose only from the approved tools listed below.",
      "Never invent URLs, shell commands, tools, or financial data.",
      "List the explanatory drivers you are testing in hypotheses, using only MARKET_DRIVEN, SECTOR_DRIVEN, FLOW_DRIVEN, COMPANY_SPECIFIC, MIXED, or UNCLEAR.",
      "Do not calculate routine numeric metrics; deterministic signals are supplied.",
      "Use the fewest evidence calls needed to resolve the question.",
      "If evidence is missing or conflicting, plan a scoped follow-up or leave it unresolved.",
      "Never produce BUY, SELL, or HOLD advice.",
      OUTPUT_LANGUAGE_INSTRUCTION,
      "Return only the requested structured plan; do not include private reasoning.",
      `Ticker: ${input.ticker}`,
      `Question: ${input.question ?? "Explain the recent movement and what to monitor."}`,
      `Baseline: ${JSON.stringify(input.baseline)}`,
      `Deterministic signals: ${JSON.stringify(input.signals)}`,
      `Routing branch: ${input.route.branch}`,
      `Routing rationale: ${input.route.rationale}`,
      `Previous investigation: ${JSON.stringify(input.previousInvestigation)}`,
      `Existing evidence: ${JSON.stringify(summarizeEvidence(input.evidence))}`,
      `Approved tools: ${JSON.stringify(tools)}`,
    ]),
  });
  return InvestigationPlanSchema.parse(object);
}

export async function synthesizeWithModel(input: SynthesizerInput): Promise<InvestigationResult> {
  const { object } = await generateObject({
    model: synthesizerModel,
    schema: InvestigationResultSchema,
    maxRetries: MODEL_MAX_RETRIES,
    prompt: withJsonContract(InvestigationResultSchema, [
      "You are the synthesis stage of an auditable Indonesian stock investigation.",
      "Explain observations from supplied data only; never invent missing facts.",
      "Use deterministic signals for numeric claims and preserve evidence conflicts.",
      "Confidence must reflect evidence quality and uncertainty; explain it in confidenceReason.",
      "Set status to 'attention' when the move is unusual or evidence is conflicting, 'normal' when the move is unremarkable, and 'unclear' when evidence is insufficient.",
      "whatToMonitor must contain 2 or 3 concrete, checkable items, not generic advice.",
      "evidenceSummary must have one entry per evidence category you actually used, with a short finding and an importance of high, medium, or low.",
      "Never produce BUY, SELL, or HOLD advice, trade instructions, guaranteed returns, or price targets as facts.",
      "Use concise product language: analysis, context, evidence, attention, confidence, and monitoring.",
      OUTPUT_LANGUAGE_INSTRUCTION,
      "Return only the requested structured result; do not include private reasoning.",
      `Ticker: ${input.ticker}`,
      `Question: ${input.question ?? "Explain the recent movement and what to monitor."}`,
      `Deterministic signals: ${JSON.stringify(input.signals)}`,
      `Previous investigation: ${JSON.stringify(input.previousInvestigation)}`,
      `Investigation plan: ${JSON.stringify(input.plan)}`,
      `Evidence: ${JSON.stringify(summarizeEvidence(input.evidence))}`,
    ]),
  });
  const parsed = InvestigationResultSchema.parse(object);
  return { ...parsed, disclaimer: INVESTIGATION_DISCLAIMER };
}

function summarizeEvidence(
  evidence: readonly { type: string; source: string; summary: string; payload?: unknown }[],
): readonly unknown[] {
  return evidence.map((item) => ({
    type: item.type,
    source: item.source,
    summary: item.summary,
    payload: stringifyForPrompt(item.payload),
  }));
}

function stringifyForPrompt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return JSON.stringify(value).slice(0, 4_000);
}
