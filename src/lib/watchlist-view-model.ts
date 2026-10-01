/**
 * Maps `GET /api/watchlist?view=dashboard` (server `WatchlistDashboardItem`)
 * into the shape the dashboard cards render from.
 */

export type WatchlistInvestigationStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "NONE";

/** One card in the dashboard watchlist. */
export interface WatchlistItem {
  ticker: string;
  companyName: string;
  latestClose: number | null;
  investigationStatus: WatchlistInvestigationStatus;
  lastInvestigatedAt: string | null;
  investigationId: string | null;
}

/** Raw shape of `GET /api/watchlist?view=dashboard`. */
export interface WatchlistDashboardResponse {
  watchlist?: {
    ticker: string;
    createdAt: string;
    companyName?: string | null;
    lastClose?: number | null;
    lastCloseDate?: string | null;
    lastInvestigation?: {
      id: string;
      status: string;
      statusLabel?: string | null;
      createdAt: string;
      completedAt?: string | null;
    } | null;
  }[];
}

/**
 * Collapses the pipeline's fine-grained stages into the four states a card
 * badge shows. Anything still running reads as IN_PROGRESS.
 */
function toInvestigationStatus(status: string | null | undefined): WatchlistInvestigationStatus {
  if (!status) return "NONE";
  if (status === "completed") return "COMPLETED";
  if (status === "failed") return "FAILED";
  return "IN_PROGRESS";
}

/** Normalises the dashboard payload into render-ready watchlist cards. */
export function toWatchlistItems(response: WatchlistDashboardResponse): WatchlistItem[] {
  return (response.watchlist ?? []).map((entry) => {
    const investigation = entry.lastInvestigation ?? null;
    return {
      ticker: entry.ticker,
      companyName: entry.companyName ?? "",
      latestClose: entry.lastClose ?? null,
      investigationStatus: toInvestigationStatus(investigation?.status),
      lastInvestigatedAt: investigation
        ? (investigation.completedAt ?? investigation.createdAt)
        : null,
      investigationId: investigation?.id ?? null,
    };
  });
}
