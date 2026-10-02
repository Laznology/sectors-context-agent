/**
 * Investigation detail route (PRD #26).
 *
 * The URL carries the ticker (e.g. /investigations/BBRI) so the address stays
 * human-readable; the API accepts either a ticker or an investigation id.
 *
 * Data:
 * - GET /api/investigations/:idOrTicker — investigation detail payload;
 * - GET /api/investigations/:idOrTicker/events — SSE stream for live status updates.
 */
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import {
  toInvestigationData,
  type InvestigationData,
  type InvestigationDetailResponse,
  type LikelyDriver,
} from "@/lib/investigation-view-model";
import { SessionGuard } from "@/lib/session";
import { useInvestigationSSE, type PipelineStatus } from "@/lib/use-investigation-sse";
import { rootRoute } from "@/routes/__root";
import { createRoute, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Banknote,
  Check,
  Factory,
  FileText,
  Globe,
  Landmark,
  LoaderCircle,
  Newspaper,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export const investigationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/investigations/$ticker",
  component: InvestigationDetailPage,
});

// Pipeline stages the stepper renders, in order.
const PIPELINE_STEPS: { status: PipelineStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "collecting_baseline", label: "Collecting Baseline" },
  { status: "calculating_signals", label: "Calculating Signals" },
  { status: "planning", label: "Planning Execution" },
  { status: "investigating", label: "Deep Investigating" },
  { status: "synthesizing", label: "Synthesizing Findings" },
  { status: "completed", label: "Completed" },
];

function InvestigationDetailPage() {
  return (
    <SessionGuard mode="require-session">
      <InvestigationContent />
    </SessionGuard>
  );
}

function InvestigationContent() {
  const params = useParams({ strict: false }) as Record<string, string>;
  const ticker = params?.ticker ?? "";
  const navigate = useNavigate();

  // 1. Live SSE Stream Connection dari /api/investigations/:ticker/events
  const { eventData } = useInvestigationSSE(ticker);

  // 2. State Laporan Akhir
  const [summaryData, setSummaryData] = useState<InvestigationData | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const currentStatusIdx = PIPELINE_STEPS.findIndex((s) => s.status === eventData.status);
  const isFailed = eventData.status === "failed";
  const isTerminal = eventData.status === "completed" || eventData.status === "failed";

  const reload = () => {
    setIsFetchingSummary(true);
    setFetchError(null);
    setReloadToken((token) => token + 1);
  };

  useEffect(() => {
    let ignore = false;

    void fetch(`/api/investigations/${ticker}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Gagal mengambil data dari API (HTTP ${res.status})`);
        }
        return toInvestigationData((await res.json()) as InvestigationDetailResponse);
      })
      .then((data) => {
        if (!ignore) setSummaryData(data);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        const message =
          err instanceof Error
            ? err.message
            : "Data laporan investigasi belum siap dari server API.";
        console.error("Error fetching investigation summary:", err);
        setFetchError(message);
      })
      .finally(() => {
        if (!ignore) setIsFetchingSummary(false);
      });

    return () => {
      ignore = true;
    };
  }, [ticker, isTerminal, reloadToken]);

  return (
    <div className="dashboard-wrapper pb-16 space-y-8">
      {/* HEADER & TOP BAR */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate({ to: "/" as any });
            }}
            className="w-fit -ml-2 text-xs text-muted-foreground"
          >
            <ArrowLeft aria-hidden />
            Kembali ke Dashboard
          </Button>
          <h1 className="dashboard-title">
            {/* The URL may carry an investigation id (history links), so prefer the loaded ticker. */}
            Investigasi Ticker:{" "}
            <span className="uppercase text-primary">{summaryData?.ticker || ticker}</span>
          </h1>
          {summaryData?.companyName && (
            <p className="text-sm text-muted-foreground">{summaryData.companyName}</p>
          )}
        </div>
      </div>

      {/* SECTION 1: LIVE INVESTIGATION PROGRESS STEPPER (8 STATUS) */}
      <section className="dashboard-panel space-y-6">
        <div>
          <h2 className="panel-title">Investigation Progress</h2>
          <p className="panel-subtitle">
            Tracking real-time eksekusi pipeline agent untuk ticker{" "}
            <strong className="uppercase">{summaryData?.ticker || ticker}</strong>.
          </p>
        </div>

        {/* Progress Stepper Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCurrent = eventData.status === step.status && eventData.status !== "completed";
            const isDone = currentStatusIdx > idx || eventData.status === "completed";

            return (
              <div
                key={step.status}
                className={`flex items-center gap-3 p-3 rounded-lg border text-xs transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                    : isDone
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                      : "border-border/40 text-muted-foreground opacity-60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-mono ${
                    isCurrent
                      ? "bg-primary text-primary-foreground animate-bounce"
                      : isDone
                        ? "bg-emerald-500 text-black font-bold"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-3" aria-hidden /> : idx + 1}
                </span>
                <span className="line-clamp-1">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Active Tool Call & Reason Box */}
        {eventData.currentTool && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-primary font-bold">
              <Wrench className="size-3.5" aria-hidden />
              Active Tool Executing
            </span>
            <p className="text-sm font-mono font-bold text-foreground">
              {eventData.currentTool.toolName}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Reason: </strong>
              {eventData.currentTool.reason}
            </p>
          </div>
        )}

        {/* Failure Alert */}
        {isFailed && (
          <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-4 space-y-1">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-rose-400">
              <TriangleAlert className="size-4" aria-hidden />
              Pipeline Execution Failed
            </h4>
            <p className="text-xs font-mono text-rose-300">
              {eventData.error || "Terjadi kesalahan pada eksekusi agen."}
            </p>
          </div>
        )}
      </section>

      {/* SECTION 2: INDIKATOR MEMUAT LAPORAN ATAU ERROR HANDLER */}
      {!summaryData && (isFetchingSummary || fetchError) && (
        <div className="dashboard-panel text-center py-8 space-y-3">
          {isFetchingSummary ? (
            <p className="flex items-center justify-center gap-2 text-sm font-mono text-primary">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Memuat laporan sintesis hasil investigasi dari backend API...
            </p>
          ) : fetchError ? (
            <div className="space-y-3">
              <p className="text-xs font-mono text-amber-400">{fetchError}</p>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw aria-hidden />
                Coba Muat Ulang Laporan API
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* SECTION 3: LAPORAN HASIL INVESTIGASI (100% DINAMIS DARI GET /api/investigations/:id) */}
      {summaryData && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Executive Summary Panel */}
          <section className="dashboard-panel space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <h2 className="panel-title">{summaryData.ticker} - Executive Summary</h2>
                <p className="text-xs text-muted-foreground italic mt-1 font-serif">
                  "{summaryData.question}"
                </p>
              </div>
              <DriverBadge driver={summaryData.likelyDriver} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                  What Changed?
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {summaryData.whatChanged}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                  Why It Matters?
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {summaryData.whyItMatters}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/30">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                Detailed Explanation
              </h3>
              <p className="text-sm leading-relaxed text-foreground/80">
                {summaryData.explanation}
              </p>
            </div>
          </section>

          {/* Evidence Cards Grid */}
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold tracking-tight">Evidence Cards</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <EvidenceCard
                title="Price / Volume"
                content={summaryData.evidence?.price_volume}
                icon={TrendingUp}
              />
              <EvidenceCard
                title="Market Context"
                content={summaryData.evidence?.market}
                icon={Globe}
              />
              <EvidenceCard
                title="Sector Context"
                content={summaryData.evidence?.sector}
                icon={Factory}
              />
              <EvidenceCard
                title="Foreign Flow"
                content={summaryData.evidence?.foreign_flow}
                icon={Banknote}
              />
              <EvidenceCard
                title="Broker Activity"
                content={summaryData.evidence?.broker}
                icon={Landmark}
              />
              <EvidenceCard
                title="News Sentiment"
                content={summaryData.evidence?.news}
                icon={Newspaper}
              />
              <EvidenceCard
                title="Official Filing"
                content={summaryData.evidence?.filing}
                icon={FileText}
              />
            </div>
          </section>

          {/* Confidence, What to Monitor & Comparison */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="dashboard-panel space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="panel-title">Confidence</h3>
                <ConfidenceBadge level={summaryData.confidence} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {summaryData.confidenceReason}
              </p>
            </div>

            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">What to Monitor</h3>
              <ul className="space-y-2 text-xs text-foreground/90 list-disc list-inside">
                {summaryData.whatToMonitor?.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">Previous Comparison</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {summaryData.previousComparison}
              </p>
            </div>
          </section>

          {/* Scoped follow-up conversation (FE wiki #5) */}
          <ChatPanel
            key={`${summaryData.id}-${summaryData.status}`}
            investigationId={summaryData.id}
            ticker={summaryData.ticker || ticker}
            initialMessages={summaryData.conversation}
            isEnabled={summaryData.status === "COMPLETED"}
          />

          {/* Disclaimer Footer */}
          <footer className="text-center pt-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground italic font-mono">
              Disclaimer: This analysis is informational and does not constitute investment advice.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

// Helpers Sub-Components
function EvidenceCard({
  title,
  content,
  icon: Icon,
}: {
  title: string;
  content?: string;
  icon: LucideIcon;
}) {
  if (!content) return null;
  return (
    <div className="dashboard-panel flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{content}</p>
    </div>
  );
}

function DriverBadge({ driver }: { driver?: LikelyDriver }) {
  if (!driver) return null;
  const styles: Record<LikelyDriver, string> = {
    MARKET_DRIVEN: "driver-market",
    SECTOR_DRIVEN: "driver-sector",
    FLOW_DRIVEN: "driver-flow",
    COMPANY_SPECIFIC: "driver-company",
    MIXED: "driver-mixed",
    UNCLEAR: "driver-unclear",
  };

  return (
    <span className={`driver-badge ${styles[driver] || "driver-unclear"}`}>
      {driver.replace("_", " ")}
    </span>
  );
}

function ConfidenceBadge({ level }: { level?: InvestigationData["confidence"] }) {
  if (!level) return null;
  const styles = {
    HIGH: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    LOW: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${styles[level]}`}
    >
      {level} CONFIDENCE
    </span>
  );
}
