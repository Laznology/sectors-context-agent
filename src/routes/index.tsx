import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard, useSession } from "@/lib/session";
import { DRIVER_TEXT, STATUS_LABEL_TEXT } from "@/shared/schemas/investigation.ts";
import {
  toWatchlistItems,
  type WatchlistDashboardResponse,
  type WatchlistItem,
} from "@/lib/watchlist-view-model";
import { rootRoute } from "@/routes/__root";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
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
  const [question, setQuestion] = useState("");
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
    if (!isoString) return "Belum pernah";
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
      setErrorMessage("Simbol ticker tidak boleh kosong.");
      return;
    }
    if (watchlist.some((item) => item.ticker === cleanTicker)) {
      setErrorMessage(`Ticker ${cleanTicker} sudah ada di watchlist Anda.`);
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
        throw new Error(
          body?.error ?? `Tidak dapat menambahkan ${cleanTicker} (HTTP ${res.status})`,
        );
      }
      setInputTicker("");
      await reloadWatchlist();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tidak dapat menambahkan ticker.");
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
        throw new Error(`Tidak dapat menghapus ${ticker} (HTTP ${res.status})`);
      }
      setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Tidak dapat menghapus ${ticker}.`);
    } finally {
      setDeletingTicker(null);
    }
  };

  const handleInvestigate = async (ticker: string) => {
    setErrorMessage(null);

    const trimmedQuestion = question.trim();
    try {
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          ...(trimmedQuestion ? { question: trimmedQuestion } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Tidak dapat memulai investigasi (HTTP ${res.status})`);
      }
      // The question belongs to the run it just started; keeping it would seed
      // the next ticker with a question written for this one.
      setQuestion("");
      // The detail route is keyed by ticker so the address stays readable; the
      // API resolves either a ticker or an investigation id.
      await navigate({ to: "/investigations/$ticker", params: { ticker } });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tidak dapat memulai investigasi.");
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* Header Utama */}
      <header className="dashboard-header">
        <div>
          <p className="text-signal-text tabular text-[11px] tracking-[0.22em] uppercase font-mono">
            Sesi aktif
          </p>
          <h1 className="dashboard-title">Selamat datang, {name}.</h1>
          <p className="dashboard-subtitle">
            Pantau ticker pasar, cek penutupan terakhir, dan jalankan investigasi berbasis bukti
            kapan saja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
            Keluar
          </Button>
        </div>
      </header>

      {/* Form Add Ticker */}
      <section className="dashboard-panel">
        <div className="mb-4">
          <h2 className="panel-title">Tambah Ticker ke Watchlist</h2>
          <p className="panel-subtitle">Masukkan simbol ticker IDX (mis. BBCA, BBRI, ANTM)</p>
        </div>

        <form onSubmit={handleAddTicker} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="grid w-full sm:w-80 gap-1.5">
              <Label htmlFor="ticker-input" className="text-xs font-medium">
                Simbol Ticker
              </Label>
              <Input
                id="ticker-input"
                placeholder="mis. BBRI"
                value={inputTicker}
                onChange={(e) => {
                  setInputTicker(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Memvalidasi..." : "Tambah ke Watchlist"}
            </Button>
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-destructive mt-1">{errorMessage}</p>
          )}
        </form>
      </section>

      {/* Watchlist Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl font-bold tracking-tight">
            Watchlist ({watchlist.length})
          </h2>
          <div className="grid w-full gap-1.5 sm:w-96">
            <Label htmlFor="question-input" className="text-xs font-medium">
              Pertanyaan untuk investigasi berikutnya (opsional)
            </Label>
            <Input
              id="question-input"
              placeholder="mis. Kenapa ANTM bergerak hari ini?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="watchlist-empty">
            <p className="flex items-center justify-center gap-2 font-medium text-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Memuat watchlist Anda…
            </p>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <p className="font-medium text-foreground">Watchlist Anda masih kosong.</p>
            <p className="text-xs">Tambahkan ticker lewat form di atas untuk mulai memantau.</p>
          </div>
        ) : (
          <ul className="watchlist-list">
            {watchlist.map((item) => (
              <li key={item.ticker} className="ticker-row">
                <Link
                  to="/investigations/$ticker"
                  params={{ ticker: item.ticker }}
                  aria-label={`Buka investigasi ${item.ticker}`}
                  className="ticker-row-main"
                >
                  <div className="min-w-0">
                    <h3 className="ticker-symbol">{item.ticker}</h3>
                    <p className="ticker-company">{item.companyName || "—"}</p>
                  </div>

                  <dl className="ticker-row-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusBadge status={item.investigationStatus} />
                      </dd>
                    </div>
                    <div>
                      <dt>Perhatian</dt>
                      <dd>{item.statusLabel ? STATUS_LABEL_TEXT[item.statusLabel] : "—"}</dd>
                    </div>
                    <div>
                      <dt>Driver</dt>
                      <dd>{item.driver ? DRIVER_TEXT[item.driver] : "—"}</dd>
                    </div>
                    <div>
                      <dt>Jumlah run</dt>
                      <dd>{item.runCount === 0 ? "Belum ada" : item.runCount}</dd>
                    </div>
                    <div>
                      <dt>Investigasi terakhir</dt>
                      <dd>{formatDate(item.lastInvestigatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="ticker-row-price">
                    <span className="ticker-price">{formatCurrency(item.latestClose)}</span>
                    <span className="text-muted-foreground text-[11px]">{item.actionReason}</span>
                  </div>
                </Link>

                <div className="ticker-row-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.primaryAction === "OPEN_REPORT" ? "outline" : "default"}
                    onClick={() =>
                      item.primaryAction === "OPEN_REPORT"
                        ? void navigate({
                            to: "/investigations/$ticker",
                            params: { ticker: item.ticker },
                          })
                        : void handleInvestigate(item.ticker)
                    }
                  >
                    {PRIMARY_ACTION_LABEL[item.primaryAction]}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus ${item.ticker} dari watchlist`}
                    title={`Hapus ${item.ticker}`}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const PRIMARY_ACTION_LABEL: Record<WatchlistItem["primaryAction"], string> = {
  INVESTIGATE: "Investigasi",
  OPEN_REPORT: "Buka laporan",
  UPDATE: "Perbarui",
};

const RUN_STATUS_TEXT: Record<WatchlistItem["investigationStatus"], string> = {
  PENDING: "Menunggu",
  IN_PROGRESS: "Sedang berjalan",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  NONE: "Belum dimulai",
};
function StatusBadge({ status }: { status: WatchlistItem["investigationStatus"] }) {
  const styles: Record<WatchlistItem["investigationStatus"], string> = {
    COMPLETED: "status-completed",
    IN_PROGRESS: "status-in-progress",
    PENDING: "status-pending",
    FAILED: "status-failed",
    NONE: "status-none",
  };

  return <span className={`status-badge ${styles[status]}`}>{RUN_STATUS_TEXT[status]}</span>;
}
