import { z } from "zod";
import {
  InvestigationClassificationSchema,
  InvestigationConfidenceSchema,
  InvestigationDriverSchema,
  InvestigationEvidenceTypeSchema,
  InvestigationToolCallStatusSchema,
} from "../../../shared/schemas/investigation.ts";
import type { DeterministicSignals, MarketPoint, PricePoint } from "../../analysis/signals.ts";

export const PricePointSchema = z.object({
  date: z.string().min(1),
  close: z.number(),
  volume: z.number(),
});

export const MarketPointSchema = z.object({
  date: z.string().min(1),
  close: z.number(),
});

export const BaselineContextSchema = z.object({
  price: z.array(PricePointSchema),
  market: z.array(MarketPointSchema),
  company: z.unknown().optional(),
});

export type BaselineContext = z.infer<typeof BaselineContextSchema>;

export const DeterministicSignalsSchema = z.object({
  latestPrice: z.number().nullable(),
  latestVolume: z.number().nullable(),
  dailyReturn: z.number().nullable(),
  marketReturn: z.number().nullable(),
  relativeReturn: z.number().nullable(),
  averageVolume: z.number().nullable(),
  volumeRatio: z.number().nullable(),
  unusualMovement: z.boolean(),
});

export type Signals = z.infer<typeof DeterministicSignalsSchema>;

/** A single fact collected from a controlled tool call. */
export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  type: InvestigationEvidenceTypeSchema,
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

export const ToolCallRecordSchema = z.object({
  id: z.string().min(1),
  toolName: z.string().min(1),
  status: InvestigationToolCallStatusSchema,
  reason: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.unknown().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  startedAt: z.iso.datetime().optional(),
  finishedAt: z.iso.datetime().optional(),
});

export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

export const InvestigationResultSchema = z.object({
  driver: InvestigationDriverSchema,
  classification: InvestigationClassificationSchema,
  confidence: InvestigationConfidenceSchema,
  whatChanged: z.string().min(1),
  whyItMatters: z.string().min(1),
  explanation: z.string().min(1),
  whatToMonitor: z.string().min(1),
  changesSincePrevious: z.string().nullable(),
});

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;

export const PreviousInvestigationSchema = z.object({
  id: z.string().uuid(),
  completedAt: z.string().nullable(),
  driver: InvestigationDriverSchema.nullable(),
  classification: InvestigationClassificationSchema.nullable(),
  confidence: InvestigationConfidenceSchema.nullable(),
  signals: z.unknown().nullable(),
  evidenceSummary: z.string().nullable(),
  whatChanged: z.string().nullable(),
  whyItMatters: z.string().nullable(),
  explanation: z.string().nullable(),
  whatToMonitor: z.string().nullable(),
});

export type PreviousInvestigation = z.infer<typeof PreviousInvestigationSchema>;

export type { DeterministicSignals, MarketPoint, PricePoint };
