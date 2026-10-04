/**
 * History route (PRD #26, FE wiki #6).
 *
 * Lists the user's previous investigations grouped by ticker, from
 * GET /api/investigations (paginated). Each run links to its detail page by
 * investigation id, so older runs stay reachable even when a ticker has a
 * newer one.
 */
import { Button } from "@/components/ui/button";
import {
  groupHistory,
  InvestigationListResponseSchema,
  type HistoryEntry,
  type HistoryStatus,
  type InvestigationListResponse,
} from "@/lib/history-view-model";
import { SessionGuard } from "@/lib/session";
import { rootRoute } from "@/routes/__root";
import { createRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

const PAGE_SIZE = 50;

type Investigation = InvestigationListResponse["investigations"][number];

async function fetchPage(offset: number, signal?: AbortSignal) {
  const res = await fetch(`/api/investigations?limit=${PAGE_SIZE}&offset=${offset}`, { signal });
  if (!res.ok) throw new Error(`Could not load history (HTTP ${res.status})`);
  const parsed = InvestigationListResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("The server returned an unexpected history response.");
  return parsed.data;
}

function HistoryPage() {
  return (
    <SessionGuard mode="require-session">
      <HistoryContent />
    </SessionGuard>
  );
}

function HistoryContent() {
  const [items, setItems] = useState<Investigation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPage(0, controller.signal)
      .then((page) => {
        setItems(page.investigations);
        setHasMore(page.pagination.hasMore);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);

  function retry() {
    setError(null);
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  }

  async function loadMore() {
    setIsLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(items.length);
      // Skip rows already shown in case a new run shifted the offsets.
      setItems((prev) => {
        const known = new Set(prev.map((item) => item.id));
        return [...prev, ...page.investigations.filter((item) => !known.has(item.id))];
      });
      setHasMore(page.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const groups = groupHistory(items);

  return (
    <div className="dashboard-wrapper space-y-8 pb-16">
      <header className="dashboard-header">
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to dashboard
          </Link>
          <h1 className="dashboard-title">Investigation history</h1>
          <p className="text-muted-foreground text-sm">
            Previous investigations, grouped by ticker. Newest first.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="watchlist-empty">
          <p className="text-foreground flex items-center justify-center gap-2 font-medium">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading history…
          </p>
        </div>
      ) : error && items.length === 0 ? (
        <div className="watchlist-empty">
          <p className="text-destructive font-mono text-xs" role="alert">
            {error}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="watchlist-empty">
          <p className="text-foreground font-medium">No investigations yet.</p>
          <p className="text-xs">
            Run an investigation for a ticker on the{" "}
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              dashboard
            </Link>
            and it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section
              key={group.ticker}
              className="dashboard-panel space-y-3"
              aria-labelledby={`history-${group.ticker}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`history-${group.ticker}`} className="panel-title">
                  {group.ticker}
                  {group.companyName && (
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                      {group.companyName}
                    </span>
                  )}
                </h2>
                <span className="text-muted-foreground text-xs">
                  {group.entries.length} run{group.entries.length === 1 ? "" : "s"}
                </span>
              </div>

              <ul className="divide-border/40 divide-y">
                {group.entries.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} ticker={group.ticker} />
                ))}
              </ul>
            </section>
          ))}

          {error && (
            <p className="text-destructive font-mono text-xs" role="alert">
              {error}
            </p>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
              >
                {isLoadingMore && <LoaderCircle className="animate-spin" aria-hidden />}
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_CLASS: Record<HistoryStatus, string> = {
  COMPLETED: "status-completed",
  IN_PROGRESS: "status-in-progress",
  FAILED: "status-failed",
};

const STATUS_LABEL: Record<HistoryStatus, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  FAILED: "Failed",
};

const CONFIDENCE_LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function HistoryRow({ entry, ticker }: { entry: HistoryEntry; ticker: string }) {
  return (
    <li>
      <Link
        to="/investigations/$ticker"
        params={{ ticker: entry.id }}
        aria-label={`Open investigation for ${ticker}, ${formatDate(entry.date)}`}
        className="hover:bg-muted/30 focus-visible:ring-ring/50 -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 outline-none focus-visible:ring-3"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <time dateTime={entry.date} className="text-foreground text-xs font-medium">
              {formatDate(entry.date)}
            </time>
            <span className={`status-badge ${STATUS_CLASS[entry.status]}`}>
              {STATUS_LABEL[entry.status]}
            </span>
            {entry.driver && (
              <span className="text-muted-foreground font-mono text-[11px]">
                {entry.driver.replaceAll("_", " ")}
              </span>
            )}
            {entry.confidence && (
              <span className="text-muted-foreground text-[11px]">
                · {CONFIDENCE_LABEL[entry.confidence]} confidence
              </span>
            )}
          </div>
          {entry.summary ? (
            <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
              {entry.summary}
            </p>
          ) : entry.status === "FAILED" ? (
            <p className="text-muted-foreground text-xs">
              This run failed, so there is no summary.
            </p>
          ) : entry.status === "IN_PROGRESS" ? (
            <p className="text-muted-foreground text-xs">This run is still in progress.</p>
          ) : null}
        </div>
        <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}
