import { z } from "zod";

/** A single fact collected from a controlled tool call. */
export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  /** Origin of the fact, e.g. `sectors:company_report`. */
  source: z.string().min(1),
  summary: z.string().min(1),
  /** Raw payload as returned by the source, kept for traceability. */
  payload: z.unknown().optional(),
  collectedAt: z.iso.datetime().optional(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * One step of the investigation plan produced by the `planInvestigation` node.
 * `tool` must name a registered tool from `src/server/tools`; the model never
 * chooses a URL or executes code.
 */
export const InvestigationPlanStepSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  tool: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
});

export type InvestigationPlanStep = z.infer<typeof InvestigationPlanStepSchema>;

export const InvestigationPlanSchema = z.object({
  steps: z.array(InvestigationPlanStepSchema),
});

export type InvestigationPlan = z.infer<typeof InvestigationPlanSchema>;
