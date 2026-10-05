import { z } from "zod";
import { toTimeline, type TimelineEntry } from "./history-view-model.ts";
export type LikelyDriver =
  | "MARKET_DRIVEN"
  | "SECTOR_DRIVEN"
  | "FLOW_DRIVEN"
  | "COMPANY_SPECIFIC"
  | "MIXED"
  | "UNCLEAR";

export type StatusLabel = "NORMAL" | "ATTENTION" | "UNCLEAR";

export type PathStepStatus = "success" | "failure" | "skipped" | "running";

export interface InvestigationPathStep {
  toolName: string;
  label: string;
  reason: string;
  status: PathStepStatus;
  findings: string[];
  durationMs: number;
}

type EvidenceCategory =
  | "price_volume"
  | "market"
  | "sector"
  | "foreign_flow"
  | "broker"
  | "news"
  | "filing";

export type EvidenceImportance = "high" | "medium" | "low";

export interface EvidenceCard {
  type: EvidenceCategory;
  label: string;
  finding: string | null;
  importance: EvidenceImportance | null;
}

const MarketSignalsSchema = z.object({
  latestPrice: z.number().nullable(),
  latestVolume: z.number().nullable(),
  dailyReturn: z.number().nullable(),
  marketReturn: z.number().nullable(),
  relativeReturn: z.number().nullable(),
  averageVolume: z.number().nullable(),
  volumeRatio: z.number().nullable(),
  unusualMovement: z.boolean(),
});

export type MarketSignals = z.infer<typeof MarketSignalsSchema>;

const AsOfDateSchema = z.iso.date();

export interface InvestigationData {
  id: string;
  ticker: string;
  companyName: string;
  asOfDate: string | null;
  question: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  statusLabel: StatusLabel | null;
  whatChanged: string;
  whyItMatters: string;
  explanation: string;
  likelyDriver: LikelyDriver;
  evidence: Partial<Record<EvidenceCategory, string>>;
  evidenceCards: EvidenceCard[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceReason: string;
  signals: MarketSignals | null;
  whatToMonitor: string[];
  investigationPath: InvestigationPathStep[];
  /** Every run for this ticker, newest first, for the workspace Timeline. */
  timeline: TimelineEntry[];
  previousComparison: string;
  conversation: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Validated UI blocks attached to this turn; null for plain-text turns. */
  uiBlocks?: unknown;
  createdAt: string;
}

export interface InvestigationDetailResponse {
  id: string;
  ticker?: string;
  companyName?: string | null;
  question?: string | null;
  status: "pending" | "completed" | "failed";
  asOfDate?: string | null;
  statusLabel?: "normal" | "attention" | "unclear" | null;
  driver?: LikelyDriver | null;
  confidence?: number | null;
  signals?: unknown;
  confidenceReason?: string | null;
  whatChanged?: string | null;
  whyItMatters?: string | null;
  explanation?: string | null;
  whatToMonitorJson?: string[] | null;
  changesSincePrevious?: string | null;
  evidence?: { type: string; summary: string }[] | null;
  evidenceSummaryJson?: EvidenceSummary[] | null;
  toolCalls?:
    | {
        toolName: string;
        reason?: string;
        status: string;
        durationMs?: number;
        errorMessage?: string;
      }[]
    | null;
  conversations?: ConversationMessage[] | null;
  runs?: RawRun[] | null;
}

/** One run of this ticker as the API returns it, before Timeline derivation. */
interface RawRun {
  id: string;
  ticker: string;
  companyName?: string | null;
  status: string;
  driver?: LikelyDriver | null;
  confidence?: number | null;
  whatChanged?: string | null;
  changesSincePrevious?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

interface EvidenceSummary {
  label: string;
  finding: string;
  importance: EvidenceImportance;
}

const EVIDENCE_CATEGORIES = new Set<string>([
  "price_volume",
  "market",
  "sector",
  "foreign_flow",
  "broker",
  "news",
  "filing",
]);

const EVIDENCE_CARDS: readonly { type: EvidenceCategory; label: string }[] = [
  { type: "price_volume", label: "Harga / Volume" },
  { type: "market", label: "Konteks Pasar" },
  { type: "sector", label: "Konteks Sektor" },
  { type: "foreign_flow", label: "Aliran Dana Asing" },
  { type: "broker", label: "Aktivitas Broker" },
  { type: "news", label: "Berita" },
  { type: "filing", label: "Laporan" },
];

const TOOL_LABELS: Record<string, string> = {
  get_price_context: "Konteks Harga",
  get_market_context: "Konteks Pasar",
  get_company_context: "Konteks Perusahaan",
  get_sector_context: "Konteks Sektor",
  get_foreign_flow: "Aliran Dana Asing",
  fetch_foreign_flow: "Aliran Dana Asing",
  get_broker_activity: "Aktivitas Broker",
  get_company_news: "Berita",
  get_company_filings: "Laporan",
};

const EVIDENCE_TYPE_BY_TOOL: Record<string, string> = {
  get_price_context: "price_volume",
  get_market_context: "market",
  get_company_context: "company",
  get_sector_context: "sector",
  get_foreign_flow: "foreign_flow",
  // Observed at runtime alongside get_foreign_flow; without it the path step
  // resolved no category and dropped the foreign-flow findings.
  fetch_foreign_flow: "foreign_flow",
  get_broker_activity: "broker",
  get_company_news: "news",
  get_company_filings: "filing",
};

export function toolLabel(toolName: string): string {
  const bare = toolName.replace(/^mcp:/, "");
  const known = TOOL_LABELS[bare];
  if (known) return known;
  return bare
    .replace(/^(get|fetch)_/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function toInvestigationData(detail: InvestigationDetailResponse): InvestigationData {
  const evidence: InvestigationData["evidence"] = {};
  for (const item of detail.evidence ?? []) {
    if (EVIDENCE_CATEGORIES.has(item.type)) {
      evidence[item.type as EvidenceCategory] = item.summary;
    }
  }

  const findingsByCategory = mapFindingsByCategory(detail.evidenceSummaryJson);
  const evidenceCards = EVIDENCE_CARDS.map(({ type, label }) => {
    const summary = findingsByCategory.get(type);
    return {
      type,
      label,
      finding: summary?.finding ?? evidence[type] ?? null,
      importance: summary?.importance ?? null,
    };
  });

  const score = detail.confidence ?? 0;
  const signals = MarketSignalsSchema.safeParse(detail.signals);
  const asOfDate = AsOfDateSchema.safeParse(detail.asOfDate);
  return {
    id: detail.id,
    ticker: detail.ticker ?? "",
    companyName: detail.companyName ?? "",
    asOfDate: asOfDate.success ? asOfDate.data : null,
    question: detail.question ?? "",
    status:
      detail.status === "completed"
        ? "COMPLETED"
        : detail.status === "failed"
          ? "FAILED"
          : "IN_PROGRESS",
    statusLabel: toStatusLabel(detail.statusLabel),
    whatChanged: detail.whatChanged ?? "",
    whyItMatters: detail.whyItMatters ?? "",
    explanation: detail.explanation ?? "",
    likelyDriver: detail.driver ?? "UNCLEAR",
    evidence,
    evidenceCards,
    confidence: score >= 0.7 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW",
    confidenceReason: detail.confidenceReason ?? "",
    signals: signals.success ? signals.data : null,
    whatToMonitor: detail.whatToMonitorJson ?? [],
    investigationPath: toInvestigationPath(detail),
    timeline: toTimeline(detail.runs ?? [], detail.ticker ?? "", detail.id),
    previousComparison: detail.changesSincePrevious ?? "",
    conversation: detail.conversations ?? [],
  };
}

function toStatusLabel(value: InvestigationDetailResponse["statusLabel"]): StatusLabel | null {
  if (value === "normal") return "NORMAL";
  if (value === "attention") return "ATTENTION";
  if (value === "unclear") return "UNCLEAR";
  return null;
}

function toInvestigationPath(detail: InvestigationDetailResponse): InvestigationPathStep[] {
  const evidenceByType = new Map<string, string[]>();
  for (const item of detail.evidence ?? []) {
    const list = evidenceByType.get(item.type) ?? [];
    list.push(item.summary);
    evidenceByType.set(item.type, list);
  }

  return (detail.toolCalls ?? []).map((call) => {
    const status = toPathStatus(call.status);
    const category = EVIDENCE_TYPE_BY_TOOL[call.toolName];
    const findings =
      status === "failure" && call.errorMessage
        ? [call.errorMessage]
        : category
          ? (evidenceByType.get(category) ?? [])
          : [];
    return {
      toolName: call.toolName,
      label: toolLabel(call.toolName),
      reason: call.reason ?? "",
      status,
      findings,
      durationMs: call.durationMs ?? 0,
    };
  });
}

function toPathStatus(status: string): PathStepStatus {
  if (status === "succeeded") return "success";
  if (status === "failed") return "failure";
  if (status === "skipped") return "skipped";
  return "running";
}

function mapFindingsByCategory(
  summaries: readonly EvidenceSummary[] | null | undefined,
): Map<EvidenceCategory, EvidenceSummary> {
  const byCategory = new Map<EvidenceCategory, EvidenceSummary>();
  for (const summary of summaries ?? []) {
    const category = categoryFromLabel(summary.label);
    if (category && !byCategory.has(category)) byCategory.set(category, summary);
  }
  return byCategory;
}

function categoryFromLabel(label: string): EvidenceCategory | null {
  const value = label.toLowerCase();
  if (/(price|volume|harga)/.test(value)) return "price_volume";
  if (/(market|index|indeks|benchmark|pasar|ihsg)/.test(value)) return "market";
  if (/(sector|subsector|peer|sektor)/.test(value)) return "sector";
  if (/(foreign|flow|asing|aliran)/.test(value)) return "foreign_flow";
  if (/(broker|pialang)/.test(value)) return "broker";
  if (/(news|berita)/.test(value)) return "news";
  if (/(filing|laporan|keterbukaan)/.test(value)) return "filing";
  return null;
}

/** The single block the investigation detail page renders for the current fetch state. */
export type PageStage = "loading" | "empty" | "progress" | "report";

export interface PageStageInput {
  /** Status of the fetched investigation, null while none has loaded yet. */
  status: InvestigationData["status"] | null;
  isFetching: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Resolves which stage of the detail page to render.
 *
 * A `COMPLETED` or `FAILED` run has a report either way, so both resolve to the
 * same stage and the transition into it stays symmetric. `loading` covers the
 * whole no-report-yet fetch state: the block it drives shows a spinner while the
 * request is in flight and the failure with its retry when it did not land.
 */
export function resolvePageStage({
  status,
  isFetching,
  error,
  notFound,
}: PageStageInput): PageStage {
  if (notFound) return "empty";
  if (status === "COMPLETED" || status === "FAILED") return "report";
  if (status === null && (isFetching || error !== null)) return "loading";
  return "progress";
}
