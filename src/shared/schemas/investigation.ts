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

/** Explanatory driver behind a market move. */
export const InvestigationDriverSchema = z.enum([
  "MARKET_DRIVEN",
  "SECTOR_DRIVEN",
  "FLOW_DRIVEN",
  "COMPANY_SPECIFIC",
  "MIXED",
  "UNCLEAR",
]);

export type InvestigationDriver = z.infer<typeof InvestigationDriverSchema>;

/** Sectors-backed evidence categories shown in the investigation UI. */
export const InvestigationEvidenceTypeSchema = z.enum([
  "price_volume",
  "market",
  "sector",
  "company",
  "foreign_flow",
  "broker",
  "news",
  "filing",
]);

export type InvestigationEvidenceType = z.infer<typeof InvestigationEvidenceTypeSchema>;

/** Lifecycle of one application-controlled semantic tool call. */
export const InvestigationToolCallStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);

// src/shared/schemas/investigation.ts

export type PipelineStatus =
  | "pending"
  | "collecting_baseline"
  | "calculating_signals"
  | "planning"
  | "investigating"
  | "synthesizing"
  | "completed"
  | "failed";

export interface InvestigationToolCall {
  toolName: string;
  reason: string;
  timestamp: string;
}

export interface InvestigationProgressEvent {
  status: PipelineStatus;
  stepIndex: number;
  totalSteps: number;
  currentTool?: InvestigationToolCall;
  error?: string;
  message?: string;
  completedAt?: string;
}

export type InvestigationToolCallStatus = z.infer<typeof InvestigationToolCallStatusSchema>;

/** Roles allowed in a ticker-scoped follow-up conversation. */
export const ConversationRoleSchema = z.enum(["user", "assistant"]);

export type ConversationRole = z.infer<typeof ConversationRoleSchema>;

/** Product-facing attention state shown on the investigation badge. */
export const InvestigationStatusLabelSchema = z.enum(["normal", "attention", "unclear"]);

export type InvestigationStatusLabel = z.infer<typeof InvestigationStatusLabelSchema>;

/** Required product disclaimer; the API never returns a result without it. */
export const INVESTIGATION_DISCLAIMER =
  "Analisis ini bersifat informasi dan bukan nasihat investasi.";

/** Confidence of the classification, normalised to 0..1. */
export const InvestigationConfidenceSchema = z.number().min(0).max(1);

export type InvestigationConfidence = z.infer<typeof InvestigationConfidenceSchema>;

/** Four-letter IDX ticker, optionally accepting a `.JK` suffix. */
export const TickerSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{4}(?:\.JK)?$/i, "Ticker must be a four-letter IDX symbol")
  .transform((value) => value.replace(/\.JK$/i, "").toUpperCase());

/** Request body used to start an investigation. */
export const InvestigationRequestSchema = z.object({
  ticker: TickerSchema,
  question: z.string().trim().min(1).optional(),
});

/** Request body for a ticker-scoped follow-up conversation. */
export const ConversationRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
});

export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;

export type InvestigationRequest = z.infer<typeof InvestigationRequestSchema>;

/** Display text for the attention state, shared by every surface that shows it. */
export const STATUS_LABEL_TEXT: Record<InvestigationStatusLabel, string> = {
  normal: "Normal",
  attention: "Perlu perhatian",
  unclear: "Belum jelas",
};

/** Display text for each explanatory driver. */
export const DRIVER_TEXT: Record<InvestigationDriver, string> = {
  MARKET_DRIVEN: "Didorong pasar",
  SECTOR_DRIVEN: "Didorong sektor",
  FLOW_DRIVEN: "Didorong arus dana",
  COMPANY_SPECIFIC: "Khusus perusahaan",
  MIXED: "Campuran",
  UNCLEAR: "Belum jelas",
};

/** Display text for the confidence level reported by the synthesis step. */
export const CONFIDENCE_TEXT: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
};

/** Display text for how much an evidence card mattered. */
export const IMPORTANCE_TEXT: Record<"high" | "medium" | "low", string> = {
  high: "Penting",
  medium: "Sedang",
  low: "Tidak penting",
};

/** Display text for each pipeline stage, so the progress grid never leaks a raw stage id. */
export const PIPELINE_STEP_TEXT: Record<PipelineStatus, string> = {
  pending: "Menunggu",
  collecting_baseline: "Mengumpulkan data dasar",
  calculating_signals: "Menghitung sinyal",
  planning: "Menyusun rencana",
  investigating: "Mengumpulkan bukti",
  synthesizing: "Menyusun penjelasan",
  completed: "Selesai",
  failed: "Gagal",
};
