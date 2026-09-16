import { generateObject } from "ai";
import { plannerModel, synthesizerModel } from "../../ai/gateway.ts";
import type { PlannerInput, SynthesizerInput } from "./graph.ts";
import {
  InvestigationPlanSchema,
  InvestigationResultSchema,
  type InvestigationPlan,
  type InvestigationResult,
} from "./schemas.ts";

export async function planWithModel(
  input: PlannerInput,
  tools: readonly { name: string; description: string }[],
): Promise<InvestigationPlan> {
  const { object } = await generateObject({
    model: plannerModel,
    schema: InvestigationPlanSchema,
    prompt: [
      "You are the planning stage of an auditable Indonesian stock investigation.",
      "Choose only from the approved semantic tools listed below.",
      "Never invent URLs, shell commands, tools, or financial data.",
      "Do not calculate routine numeric metrics; deterministic signals are supplied.",
      "Use the fewest evidence calls needed to resolve the question.",
      "If evidence is missing or conflicting, plan a scoped follow-up or leave it unresolved.",
      "Never produce BUY, SELL, or HOLD advice.",
      "Return only the requested structured plan; do not include private reasoning.",
      `Ticker: ${input.ticker}`,
      `Question: ${input.question ?? "Explain the recent movement and what to monitor."}`,
      `Baseline: ${JSON.stringify(input.baseline)}`,
      `Deterministic signals: ${JSON.stringify(input.signals)}`,
      `Previous investigation: ${JSON.stringify(input.previousInvestigation)}`,
      `Existing evidence: ${JSON.stringify(summarizeEvidence(input.evidence))}`,
      `Approved tools: ${JSON.stringify(tools)}`,
    ].join("\n"),
  });
  return InvestigationPlanSchema.parse(object);
}

export async function synthesizeWithModel(input: SynthesizerInput): Promise<InvestigationResult> {
  const { object } = await generateObject({
    model: synthesizerModel,
    schema: InvestigationResultSchema,
    prompt: [
      "You are the synthesis stage of an auditable Indonesian stock investigation.",
      "Explain observations from supplied data only; never invent missing facts.",
      "Use deterministic signals for numeric claims and preserve evidence conflicts.",
      "Confidence must reflect evidence quality and uncertainty.",
      "Never produce BUY, SELL, or HOLD advice, trade instructions, guaranteed returns, or price targets as facts.",
      "Use concise product language: analysis, context, evidence, attention, confidence, and monitoring.",
      "Return only the requested structured result; do not include private reasoning.",
      `Ticker: ${input.ticker}`,
      `Question: ${input.question ?? "Explain the recent movement and what to monitor."}`,
      `Deterministic signals: ${JSON.stringify(input.signals)}`,
      `Previous investigation: ${JSON.stringify(input.previousInvestigation)}`,
      `Investigation plan: ${JSON.stringify(input.plan)}`,
      `Evidence: ${JSON.stringify(summarizeEvidence(input.evidence))}`,
    ].join("\n"),
  });
  return InvestigationResultSchema.parse(object);
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
