import { FollowUpChatWidget } from "@/components/follow-up-chat-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard, useSession } from "@/lib/session";
import {
  toWatchlistItems,
  type WatchlistDashboardResponse,
  type WatchlistItem,
} from "@/lib/watchlist-view-model";
import { rootRoute } from "@/routes/__root";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Trash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import "@/index.css";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

function IndexPage() {
  return (
    <SessionGuard mode="require-session">
      <AppShell />
    </SessionGuard>
  );
}

function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const name = session.data?.user.name ?? "";

  // The watchlist is server state; the API is the single source of truth.
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputTicker, setInputTicker] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);

  // Fetches the dashboard payload. State updates happen in the caller so the
  // effect can defer them (see the effect below).
  const fetchWatchlist = useCallback(async () => {
    const res = await fetch("/api/watchlist?view=dashboard");
    if (!res.ok) {
      throw new Error(`Could not load your watchlist (HTTP ${res.status})`);
    }
    return toWatchlistItems((await res.json()) as WatchlistDashboardResponse);
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchWatchlist()
      .then((items) => {
        if (!ignore) setWatchlist(items);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setErrorMessage(err instanceof Error ? err.message : "Could not load your watchlist.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchWatchlist]);

  /** Re-reads the watchlist after a mutation, from an event handler. */
  const reloadWatchlist = async () => {
    try {
      setWatchlist(await fetchWatchlist());
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not load your watchlist.");
    }
  };

  async function handleSignOut() {
    await authClient.signOut({});
    await navigate({ to: "/sign-in", replace: true });
  }

  const formatCurrency = (val: number | null) => {
    if (val === null) return "—";
    // Watchlist tickers are IDX symbols, so the latest close is quoted in IDR.
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
    return new Date(isoString).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTicker = inputTicker.trim().toUpperCase();
    if (!cleanTicker) {
      setErrorMessage("Ticker symbol cannot be empty.");
      return;
    }
    if (watchlist.some((item) => item.ticker === cleanTicker)) {
      setErrorMessage(`Ticker ${cleanTicker} is already in your watchlist.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: cleanTicker }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not add ${cleanTicker} (HTTP ${res.status})`);
      }
      setInputTicker("");
      await reloadWatchlist();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not add the ticker.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTicker = async (ticker: string) => {
    setErrorMessage(null);
    setDeletingTicker(ticker);
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Could not remove ${ticker} (HTTP ${res.status})`);
      }
      setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Could not remove ${ticker}.`);
    } finally {
      setDeletingTicker(null);
    }
  };

  const handleInvestigate = async (ticker: string) => {
    setErrorMessage(null);

    try {
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not start investigation (HTTP ${res.status})`);
      }
      // The detail route is keyed by ticker so the address stays readable; the
      // API resolves either a ticker or an investigation id.
      await navigate({ to: `/investigations/${ticker}` as any });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not start investigation.");
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* Header Utama */}
      <header className="dashboard-header">
        <div>
          <p className="text-signal-text tabular text-[11px] tracking-[0.22em] uppercase font-mono">
            Signed in
          </p>
          <h1 className="dashboard-title">Welcome, {name}.</h1>
          <p className="dashboard-subtitle">
            Monitor market tickers, check latest close prices, and perform real-time evidence-backed
            investigations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      {/* Form Add Ticker */}
      <section className="dashboard-panel">
        <div className="mb-4">
          <h2 className="panel-title">Add Watchlist Ticker</h2>
          <p className="panel-subtitle">Enter an IDX ticker symbol (e.g. BBCA, BBRI, ANTM)</p>
        </div>

        <form onSubmit={handleAddTicker} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="grid w-full sm:w-80 gap-1.5">
              <Label htmlFor="ticker-input" className="text-xs font-medium">
                Ticker Symbol
              </Label>
              <Input
                id="ticker-input"
                placeholder="e.g. BBRI"
                value={inputTicker}
                onChange={(e) => {
                  setInputTicker(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Validating..." : "Add to Watchlist"}
            </Button>
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-destructive mt-1">{errorMessage}</p>
          )}
        </form>
      </section>

      {/* Watchlist Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold tracking-tight">
            Watchlist ({watchlist.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="watchlist-empty">
            <p className="flex items-center justify-center gap-2 font-medium text-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading your watchlist…
            </p>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <p className="font-medium text-foreground">Your watchlist is currently empty.</p>
            <p className="text-xs">Add a ticker using the form above to start monitoring.</p>
          </div>
        ) : (
          <div className="watchlist-grid">
            {watchlist.map((item) => (
              <div key={item.ticker} className="ticker-card">
                {/* Header Card */}
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="ticker-symbol">{item.ticker}</h3>
                    <p className="ticker-company">{item.companyName || "—"}</p>
                  </div>
                  <div className="flex items-start gap-1.5 shrink-0">
                    <span className="ticker-price">{formatCurrency(item.latestClose)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${item.ticker} from watchlist`}
                      title={`Remove ${item.ticker}`}
                      disabled={deletingTicker === item.ticker}
                      onClick={() => handleRemoveTicker(item.ticker)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      {deletingTicker === item.ticker ? (
                        <LoaderCircle className="animate-spin" aria-hidden />
                      ) : (
                        <Trash aria-hidden />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Details & Status */}
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <div className="ticker-meta-row">
                    <span className="ticker-meta-label">Status Investigasi:</span>
                    <StatusBadge status={item.investigationStatus} />
                  </div>
                  <div className="ticker-meta-row">
                    <span className="ticker-meta-label">Terakhir Diinvestigasi:</span>
                    <span className="ticker-meta-value">{formatDate(item.lastInvestigatedAt)}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-3 hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleInvestigate(item.ticker)}
                  >
                    Investigate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isLoading && <FollowUpChatWidget watchlist={watchlist} />}
    </div>
  );
}

function StatusBadge({ status }: { status: WatchlistItem["investigationStatus"] }) {
  const styles: Record<WatchlistItem["investigationStatus"], string> = {
    COMPLETED: "status-completed",
    IN_PROGRESS: "status-in-progress",
    PENDING: "status-pending",
    FAILED: "status-failed",
    NONE: "status-none",
  };

  return (
    <span className={`status-badge ${styles[status]}`}>
      {status === "NONE" ? "NOT STARTED" : status.replace("_", " ")}
    </span>
  );
}
