import { AddTickerDialog } from "@/components/add-ticker-dialog";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard } from "@/lib/session";
import {
  toWatchlistItems,
  type WatchlistDashboardResponse,
  type WatchlistItem,
} from "@/lib/watchlist-view-model";
import { rootRoute } from "@/routes/__root";
import { DRIVER_TEXT, STATUS_LABEL_TEXT } from "@/shared/schemas/investigation.ts";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Plus, Trash } from "lucide-react";
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
  const navigate = useNavigate();

  // The watchlist is server state; the API is the single source of truth.
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddTickerOpen, setIsAddTickerOpen] = useState(false);
  const [addTickerQuery, setAddTickerQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);

  // Fetches the dashboard payload. State updates happen in the caller so the
  // effect can defer them (see the effect below).
  const fetchWatchlist = useCallback(async () => {
    const res = await fetch("/api/watchlist?view=dashboard");
    if (!res.ok) {
      throw new Error(`Watchlist tidak dapat dimuat (HTTP ${res.status}).`);
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
        setErrorMessage(err instanceof Error ? err.message : "Watchlist tidak dapat dimuat.");
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
      setErrorMessage(err instanceof Error ? err.message : "Watchlist tidak dapat dimuat.");
    }
  };

  async function handleSignOut() {
    await authClient.signOut({});
    await navigate({ to: "/sign-in", replace: true });
  }

  const formatCurrency = (val: number | null) => {
    if (val === null) return "Harga belum tersedia";
    // Watchlist tickers are IDX symbols, so the latest close is quoted in IDR.
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Belum pernah";
    return new Date(isoString).toLocaleDateString("id-ID", { dateStyle: "medium" });
  };

  function openAddTickerDialog(query = "") {
    setAddTickerQuery(query);
    setIsAddTickerOpen(true);
  }

  const handleAddTicker = async (ticker: string): Promise<string | null> => {
    setErrorMessage(null);
    const cleanTicker = ticker.trim().toUpperCase();
    if (watchlist.some((item) => item.ticker === cleanTicker)) {
      return `Ticker ${cleanTicker} sudah ada di watchlist.`;
    }

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: cleanTicker }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ?? `Tidak dapat menambahkan ${cleanTicker} (HTTP ${res.status}).`,
        );
      }
      await reloadWatchlist();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Tidak dapat menambahkan ticker.";
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
        throw new Error(body?.error ?? `Tidak dapat memulai investigasi (HTTP ${res.status}).`);
      }
      setQuestion("");
      await navigate({ to: "/investigations/$ticker", params: { ticker } });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Tidak dapat memulai investigasi.");
    }
  };

  function handlePaletteSelect(item: WatchlistItem) {
    if (item.primaryAction === "OPEN_REPORT") {
      void navigate({ to: "/investigations/$ticker", params: { ticker: item.ticker } });
    } else {
      void handleInvestigate(item.ticker);
    }
  }

  const summaryGroups = [
    {
      label: "Perlu perhatian",
      tickers: watchlist.filter((item) => item.statusLabel === "attention"),
    },
    {
      label: "Data baru tersedia",
      tickers: watchlist.filter((item) => item.primaryAction === "UPDATE"),
    },
    {
      label: "Belum pernah dianalisis",
      tickers: watchlist.filter((item) => item.runCount === 0),
    },
  ];

  return (
    <div className={`dashboard-wrapper ${watchlist.length > 0 ? "lg:pb-32" : ""}`}>
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Watchlist</h1>
          <p className="dashboard-subtitle">
            Lihat konteks terakhir, temukan perubahan, lalu lanjutkan investigasi.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <CommandPalette
            watchlist={watchlist}
            onSelectTicker={handlePaletteSelect}
            onAddTicker={openAddTickerDialog}
          />
          <Button type="button" size="sm" onClick={() => openAddTickerDialog()}>
            <Plus aria-hidden />
            Tambah ticker
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
            Keluar
          </Button>
        </div>
      </header>

      {!isLoading && watchlist.length > 0 && (
        <section aria-label="Ringkasan watchlist" className="space-y-3">
          <h2 className="text-base font-semibold">Ringkasan</h2>
          <div className="grid gap-x-6 sm:grid-cols-3">
            {summaryGroups.map(({ label, tickers }) => {
              const visibleTickers = tickers
                .slice(0, 3)
                .map((item) => item.ticker)
                .join(", ");
              const remainingCount = tickers.length - 3;

              return (
                <div
                  key={label}
                  className="border-t border-border/40 py-3 sm:border-t-0 sm:border-l sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-medium">{label}</h3>
                    <span className="tabular font-mono text-lg">{tickers.length}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tickers.length === 0
                      ? "Tidak ada"
                      : `${visibleTickers}${remainingCount > 0 ? `, +${remainingCount} lainnya` : ""}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4" aria-label="Saham yang dipantau">
        <div className="space-y-4 border-b border-border/40 pb-4">
          <div>
            <h2 className="text-base font-semibold">Saham yang dipantau</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {watchlist.length} saham <span aria-hidden>·</span> Data penutupan harian, bukan live
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-destructive text-sm" role="alert">
            {errorMessage}
          </p>
        )}

        {isLoading ? (
          <div className="watchlist-list" role="status" aria-label="Memuat watchlist">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                aria-hidden
                className="grid animate-pulse grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/40 px-4 py-4 last:border-b-0"
              >
                <span className="space-y-2">
                  <span className="block h-4 w-20 rounded bg-muted/80" />
                  <span className="block h-3 w-40 max-w-full rounded bg-muted/60" />
                </span>
                <span className="h-7 w-24 rounded bg-muted/70" />
              </div>
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <h3 className="font-medium text-foreground">Mulai dari saham yang Anda ikuti</h3>
            <p className="mx-auto max-w-md text-xs leading-relaxed">
              Cari ticker berdasarkan kode atau nama perusahaan. Pilihan direktori demo tersedia di
              pencarian.
            </p>
            <Button type="button" size="sm" onClick={() => openAddTickerDialog()}>
              <Plus aria-hidden />
              Tambah saham pertama
            </Button>
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
                    <h2 className="ticker-symbol">{item.ticker}</h2>
                    <p className="ticker-company">
                      {item.companyName || "Nama perusahaan belum tersedia"}
                    </p>
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
                      <dd>
                        {item.statusLabel
                          ? STATUS_LABEL_TEXT[item.statusLabel]
                          : "Belum dianalisis"}
                      </dd>
                    </div>
                    <div>
                      <dt>Driver utama</dt>
                      <dd>{item.driver ? DRIVER_TEXT[item.driver] : "Belum dianalisis"}</dd>
                    </div>
                    <div>
                      <dt>Terakhir dianalisis</dt>
                      <dd>{formatDate(item.lastInvestigatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="ticker-row-price">
                    <span className="ticker-price">{formatCurrency(item.latestClose)}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {item.latestCloseDate
                        ? `Penutupan ${formatDate(item.latestCloseDate)}`
                        : "Data penutupan belum tersedia"}
                    </span>
                    <span className="max-w-48 text-muted-foreground text-[11px]">
                      {item.actionReason}
                    </span>
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
                    onClick={() => void handleRemoveTicker(item.ticker)}
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

      {watchlist.length > 0 && (
        <section
          aria-label="Fokus investigasi berikutnya"
          className="relative z-10 w-full max-w-6xl rounded-xl border border-border/70 bg-panel px-4 py-3 sm:px-5 lg:fixed lg:inset-x-4 lg:bottom-[calc(env(safe-area-inset-bottom)+1rem)] lg:z-20 lg:mx-auto lg:w-auto"
        >
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <Label htmlFor="question-input" className="text-sm font-medium">
              Fokus investigasi berikutnya
            </Label>
            <p id="question-help" className="text-[11px] leading-4 text-muted-foreground">
              Diterapkan saat Anda memilih Investigasi atau Perbarui.
            </p>
          </div>
          <Input
            id="question-input"
            className="h-11 bg-background/70"
            placeholder="Contoh: Apa yang menjelaskan selisih pergerakan dengan IHSG?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-describedby="question-help"
          />
        </section>
      )}

      <AddTickerDialog
        isOpen={isAddTickerOpen}
        query={addTickerQuery}
        existingTickers={watchlist.map((item) => item.ticker)}
        onQueryChange={setAddTickerQuery}
        onClose={() => {
          setIsAddTickerOpen(false);
          setAddTickerQuery("");
        }}
        onAdd={handleAddTicker}
      />
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
