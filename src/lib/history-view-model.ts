/**
 * Maps `GET /api/investigations` (server `InvestigationSummary[]`) into the
 * ticker groups the history page renders (FE wiki #6).
 */
import { z } from "zod";

const DriverSchema = z.enum([
  "MARKET_DRIVEN",
  "SECTOR_DRIVEN",
  "FLOW_DRIVEN",
  "COMPANY_SPECIFIC",
  "MIXED",
  "UNCLEAR",
]);

const InvestigationSummarySchema = z.object({
  id: z.string(),
  ticker: z.string(),
  companyName: z.string().nullish(),
  status: z.string(),
  driver: DriverSchema.nullish(),
  confidence: z.number().nullish(),
  whatChanged: z.string().nullish(),
  createdAt: z.string(),
  completedAt: z.string().nullish(),
});

export const InvestigationListResponseSchema = z.object({
  investigations: z.array(InvestigationSummarySchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

export type InvestigationListResponse = z.infer<typeof InvestigationListResponseSchema>;
type InvestigationSummary = z.infer<typeof InvestigationSummarySchema>;

export type HistoryStatus = "COMPLETED" | "IN_PROGRESS" | "FAILED";
export type HistoryConfidence = "HIGH" | "MEDIUM" | "LOW";

/** One past investigation run. */
export interface HistoryEntry {
  id: string;
  status: HistoryStatus;
  driver: z.infer<typeof DriverSchema> | null;
  /** Null until synthesis has produced a confidence score. */
  confidence: HistoryConfidence | null;
  summary: string;
  /** Completion time when available, otherwise when the run started. */
  date: string;
}

/** All runs for one ticker, newest first. */
export interface HistoryGroup {
  ticker: string;
  companyName: string;
  entries: HistoryEntry[];
}

function toStatus(status: string): HistoryStatus {
  if (status === "completed") return "COMPLETED";
  if (status === "failed") return "FAILED";
  return "IN_PROGRESS";
}

/** Same bands as the investigation detail view. */
function toConfidence(score: number | null | undefined): HistoryConfidence | null {
  if (score === null || score === undefined) return null;
  return score >= 0.7 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW";
}

function toEntry(item: InvestigationSummary): HistoryEntry {
  return {
    id: item.id,
    status: toStatus(item.status),
    driver: item.driver ?? null,
    confidence: toConfidence(item.confidence),
    summary: item.whatChanged ?? "",
    date: item.completedAt ?? item.createdAt,
  };
}

/**
 * Groups runs by ticker. Groups are ordered by their newest run, so the ticker
 * investigated most recently comes first.
 */
export function groupHistory(items: readonly InvestigationSummary[]): HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();
  for (const item of items) {
    let group = groups.get(item.ticker);
    if (!group) {
      group = { ticker: item.ticker, companyName: "", entries: [] };
      groups.set(item.ticker, group);
    }
    if (!group.companyName && item.companyName) group.companyName = item.companyName;
    group.entries.push(toEntry(item));
  }

  const byNewest = (a: HistoryEntry, b: HistoryEntry) => b.date.localeCompare(a.date);
  const result = [...groups.values()];
  for (const group of result) group.entries.sort(byNewest);
  return result.sort((a, b) => byNewest(a.entries[0], b.entries[0]));
}
