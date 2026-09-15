import { z } from "zod";

/** Lifecycle of a single stock investigation run. */
export const InvestigationStatusSchema = z.enum([
  "pending",
  "collecting_baseline",
  "calculating_signals",
  "planning",
  "investigating",
  "synthesizing",
  "completed",
  "failed",
]);

export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;

/** Verdict produced by the synthesis step. */
export const InvestigationClassificationSchema = z.enum([
  "bullish",
  "neutral",
  "bearish",
  "inconclusive",
]);

export type InvestigationClassification = z.infer<typeof InvestigationClassificationSchema>;

/** Confidence of the classification, normalised to 0..1. */
export const InvestigationConfidenceSchema = z.number().min(0).max(1);

export type InvestigationConfidence = z.infer<typeof InvestigationConfidenceSchema>;

/** Request body used to start an investigation. */
export const InvestigationRequestSchema = z.object({
  ticker: z.string().min(1),
  question: z.string().min(1).optional(),
});

export type InvestigationRequest = z.infer<typeof InvestigationRequestSchema>;
