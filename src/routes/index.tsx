import { useState, useEffect } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { SessionGuard, useSession } from "@/lib/session";
import { rootRoute } from "@/routes/__root";

// Pastikan mengimpor index.css
import "@/index.css";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

interface WatchlistItem {
  id: string;
  ticker: string;
  companyName: string;
  latestClose: number;
  investigationStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "NONE";
  lastInvestigatedAt: string | null;
}

const INITIAL_WATCHLIST: WatchlistItem[] = [
  {
    id: "1",
    ticker: "AAPL",
    companyName: "Apple Inc.",
    latestClose: 224.23,
    investigationStatus: "NONE",
    lastInvestigatedAt: null,
  },
  {
    id: "2",
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    latestClose: 116.0,
    investigationStatus: "NONE",
    lastInvestigatedAt: null,
  },
  {
    id: "3",
    ticker: "TSLA",
    companyName: "Tesla, Inc.",
    latestClose: 254.27,
    investigationStatus: "NONE",
    lastInvestigatedAt: null,
  },
];

const MOCK_VALID_TICKERS: Record<string, string> = {
  AAPL: "Apple Inc.",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla, Inc.",
  AMZN: "Amazon.com, Inc.",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  BBCA: "Bank Central Asia Tbk.",
  BBRI: "Bank Rakyat Indonesia Tbk.",
};

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

  // Persistence dengan LocalStorage
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    const saved = localStorage.getItem("watchlist_items");
    return saved ? JSON.parse(saved) : INITIAL_WATCHLIST;
  });

  const [inputTicker, setInputTicker] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem("watchlist_items", JSON.stringify(watchlist));
  }, [watchlist]);

  async function handleSignOut() {
    await authClient.signOut({});
    await navigate({ to: "/sign-in", replace: true });
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
    return new Date(isoString).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleAddTicker = (e: React.FormEvent) => {
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

    setTimeout(() => {
      const companyName = MOCK_VALID_TICKERS[cleanTicker] || `${cleanTicker} Corp.`;

      const newItem: WatchlistItem = {
        id: Date.now().toString(),
        ticker: cleanTicker,
        companyName: companyName,
        latestClose: +(Math.random() * 200 + 50).toFixed(2),
        investigationStatus: "NONE",
        lastInvestigatedAt: null,
      };

      setWatchlist((prev) => [newItem, ...prev]);
      setInputTicker("");
      setIsSubmitting(false);
    }, 300);
  };

  const handleInvestigate = (ticker: string) => {
    const cleanTicker = ticker.toUpperCase();

    setWatchlist((prevWatchlist) =>
      prevWatchlist.map((item) => {
        if (item.ticker === cleanTicker) {
          return {
            ...item,
            investigationStatus: "IN_PROGRESS",
            lastInvestigatedAt: new Date().toISOString(),
          };
        }
        return item;
      }),
    );

    // Gunakan 'void' di depan navigate
    void navigate({
      to: `/investigations/${ticker.toLowerCase()}` as any,
    });
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
          <p className="panel-subtitle">Enter ticker symbol (e.g. AAPL, NVDA, TSLA, BBRI)</p>
        </div>

        <form onSubmit={handleAddTicker} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="grid w-full sm:w-80 gap-1.5">
              <Label htmlFor="ticker-input" className="text-xs font-medium">
                Ticker Symbol
              </Label>
              <Input
                id="ticker-input"
                placeholder="e.g. AAPL"
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

        {watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <p className="font-medium text-foreground">Your watchlist is currently empty.</p>
            <p className="text-xs">Add a ticker using the form above to start monitoring.</p>
          </div>
        ) : (
          <div className="watchlist-grid">
            {watchlist.map((item) => (
              <div key={item.id} className="ticker-card">
                {/* Header Card */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="ticker-symbol">{item.ticker}</h3>
                    <p className="ticker-company">{item.companyName}</p>
                  </div>
                  <span className="ticker-price">{formatCurrency(item.latestClose)}</span>
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
