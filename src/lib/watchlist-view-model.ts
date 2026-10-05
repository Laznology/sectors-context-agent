/**
 * Maps `GET /api/watchlist?view=dashboard` (server `WatchlistDashboardItem`)
 * into the shape the dashboard cards render from, including the continuity
 * state and the primary action that follows from it.
 */
import {
  InvestigationDriverSchema,
  InvestigationStatusLabelSchema,
  type InvestigationDriver,
  type InvestigationStatusLabel,
} from "../shared/schemas/investigation.ts";
import { hasNewerSession, latestAvailableSession } from "./session-freshness.ts";

export type WatchlistInvestigationStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "NONE";

/** Whether the ticker has a story, and whether that story is still current. */
export type Continuity = "NONE" | "RUNNING" | "FRESH" | "STALE";

/** What the card's primary button should do. */
export type PrimaryAction = "INVESTIGATE" | "OPEN_REPORT" | "UPDATE";

/** One card in the dashboard watchlist. */
export interface WatchlistItem {
  ticker: string;
  companyName: string;
  latestClose: number | null;
  latestCloseDate: string | null;
  investigationStatus: WatchlistInvestigationStatus;
  lastInvestigatedAt: string | null;
  investigationId: string | null;
  driver: InvestigationDriver | null;
  statusLabel: InvestigationStatusLabel | null;
  runCount: number;
  continuity: Continuity;
  primaryAction: PrimaryAction;
  actionReason: string;
}

/** Raw shape of `GET /api/watchlist?view=dashboard`. */
export interface WatchlistDashboardResponse {
  watchlist?: {
    ticker: string;
    createdAt: string;
    companyName?: string | null;
    lastClose?: number | null;
    lastCloseDate?: string | null;
    runCount?: number | null;
    lastInvestigation?: {
      id: string;
      status: string;
      statusLabel?: string | null;
      driver?: string | null;
      createdAt: string;
      completedAt?: string | null;
      asOfDate?: string | null;
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** `2026-10-02` reads as `2 Okt`, matching the interface's Indonesian chrome. */
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split("-");
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName}` : isoDate;
}

/**
 * Resolves what the card offers, and why.
 *
 * The reason is always present so a button that changes label never looks
 * arbitrary (parent spec, "The adaptive action must always explain itself").
 */
function resolveContinuity(input: {
  readonly status: WatchlistInvestigationStatus;
  readonly asOfDate: string | null;
  readonly completedAt: string | null;
  readonly latestSession: string;
}): { continuity: Continuity; primaryAction: PrimaryAction; actionReason: string } {
  if (input.status === "IN_PROGRESS" || input.status === "PENDING") {
    return {
      continuity: "RUNNING",
      primaryAction: "OPEN_REPORT",
      actionReason: "Investigasi sedang berjalan",
    };
  }

  if (input.status !== "COMPLETED") {
    return {
      continuity: "NONE",
      primaryAction: "INVESTIGATE",
      actionReason: "Belum ada investigasi",
    };
  }

  const reference = input.completedAt ?? input.asOfDate;
  const label = reference ? formatShortDate(reference) : null;

  if (hasNewerSession(input.asOfDate, input.latestSession)) {
    return {
      continuity: "STALE",
      primaryAction: "UPDATE",
      actionReason: "Sesi data baru tersedia sejak investigasi terakhir",
    };
  }

  return {
    continuity: "FRESH",
    primaryAction: "OPEN_REPORT",
    actionReason: label ? `Laporan dari ${label}` : "Laporan tersedia",
  };
}

/**
 * Normalises the dashboard payload into render-ready watchlist cards.
 *
 * `latestSession` is injectable so the derivation stays pure and testable; the
 * server passes the real value, tests pass a fixed one.
 */
export function toWatchlistItems(
  response: WatchlistDashboardResponse,
  options: { latestSession?: string } = {},
): WatchlistItem[] {
  const latestSession = options.latestSession ?? latestAvailableSession();

  return (response.watchlist ?? []).map((entry) => {
    const investigation = entry.lastInvestigation ?? null;
    const investigationStatus = toInvestigationStatus(investigation?.status);
    const driver = InvestigationDriverSchema.safeParse(investigation?.driver).data ?? null;
    const statusLabel =
      InvestigationStatusLabelSchema.safeParse(investigation?.statusLabel).data ?? null;

    return {
      ticker: entry.ticker,
      companyName: entry.companyName ?? "",
      latestClose: entry.lastClose ?? null,
      latestCloseDate: entry.lastCloseDate ?? null,
      investigationStatus,
      lastInvestigatedAt: investigation
        ? (investigation.completedAt ?? investigation.createdAt)
        : null,
      investigationId: investigation?.id ?? null,
      driver,
      statusLabel,
      runCount: entry.runCount ?? (investigation ? 1 : 0),
      ...resolveContinuity({
        status: investigationStatus,
        asOfDate: investigation?.asOfDate ?? null,
        completedAt: investigation?.completedAt ?? null,
        latestSession,
      }),
    };
  });
}
