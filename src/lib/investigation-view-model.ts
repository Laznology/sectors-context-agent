/**
 * Maps `GET /api/investigations/:id` (server `InvestigationDetail`) into the
 * view model the investigation report renders from.
 */

export type LikelyDriver =
  | "MARKET_DRIVEN"
  | "SECTOR_DRIVEN"
  | "FLOW_DRIVEN"
  | "COMPANY_SPECIFIC"
  | "MIXED"
  | "UNCLEAR";

export interface ToolCall {
  toolName: string;
  reason: string;
  status: "success" | "failure";
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

/** View model the report sections render from. */
export interface InvestigationData {
  id: string;
  ticker: string;
  companyName: string;
  question: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  whatChanged: string;
  whyItMatters: string;
  explanation: string;
  likelyDriver: LikelyDriver;
  evidence: Partial<Record<EvidenceCategory, string>>;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceReason: string;
  whatToMonitor: string[];
  investigationPath: ToolCall[];
  previousComparison: string;
  conversation: ConversationMessage[];
}

/** One persisted turn of the scoped follow-up conversation. */
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** Raw shape of `GET /api/investigations/:id` (see server `InvestigationDetail`). */
export interface InvestigationDetailResponse {
  id: string;
  ticker?: string;
  companyName?: string | null;
  question?: string | null;
  status: "pending" | "completed" | "failed";
  driver?: LikelyDriver | null;
  confidence?: number | null;
  confidenceReason?: string | null;
  whatChanged?: string | null;
  whyItMatters?: string | null;
  explanation?: string | null;
  whatToMonitorJson?: string[] | null;
  changesSincePrevious?: string | null;
  evidence?: { type: string; summary: string }[] | null;
  toolCalls?:
    | {
        toolName: string;
        reason?: string;
        status: string;
        durationMs?: number;
      }[]
    | null;
  conversations?: ConversationMessage[] | null;
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

/** Normalises the API payload into the view model the report renders. */
export function toInvestigationData(detail: InvestigationDetailResponse): InvestigationData {
  const evidence: InvestigationData["evidence"] = {};
  for (const item of detail.evidence ?? []) {
    if (EVIDENCE_CATEGORIES.has(item.type)) {
      evidence[item.type as EvidenceCategory] = item.summary;
    }
  }

  const score = detail.confidence ?? 0;
  return {
    id: detail.id,
    ticker: detail.ticker ?? "",
    companyName: detail.companyName ?? "",
    question: detail.question ?? "",
    status:
      detail.status === "completed"
        ? "COMPLETED"
        : detail.status === "failed"
          ? "FAILED"
          : "IN_PROGRESS",
    whatChanged: detail.whatChanged ?? "",
    whyItMatters: detail.whyItMatters ?? "",
    explanation: detail.explanation ?? "",
    likelyDriver: detail.driver ?? "UNCLEAR",
    evidence,
    confidence: score >= 0.7 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW",
    confidenceReason: detail.confidenceReason ?? "",
    whatToMonitor: detail.whatToMonitorJson ?? [],
    investigationPath: (detail.toolCalls ?? []).map((call) => ({
      toolName: call.toolName,
      reason: call.reason ?? "",
      status: call.status === "succeeded" ? "success" : "failure",
      durationMs: call.durationMs ?? 0,
    })),
    previousComparison: detail.changesSincePrevious ?? "",
    conversation: detail.conversations ?? [],
  };
}
