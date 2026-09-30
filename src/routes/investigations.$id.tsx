/**
 * Investigation detail route (PRD #26).
 *
 * TODO(frontend): implement.
 *
 * Data:
 * - GET /api/investigations/:id — investigation detail payload;
 * - GET /api/investigations/:id/events — SSE stream for live status updates.
 *
 * Sections:
 * - header: ticker + company name;
 * - status badge (e.g. NEEDS ATTENTION);
 * - what changed, why (agent explanation);
 * - evidence cards, see components/evidence-panel.tsx;
 * - confidence, what to monitor (2-3 items max);
 * - scoped follow-up chat, see components/chat-panel.tsx (PRD #19).
 */
import { useState, useEffect } from "react";
import { createRoute, useNavigate, useParams } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";
import { SessionGuard } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { useInvestigationSSE, type PipelineStatus } from "@/lib/use-investigation-sse";

export const investigationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/investigations/$id",
  component: InvestigationDetailPage,
});

// Types & Interfaces untuk Payload Laporan Asli dari Backend
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
  evidence: {
    priceVolume: string;
    market: string;
    sector: string;
    foreignFlow: string;
    broker: string;
    news: string;
    filing: string;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceReason: string;
  whatToMonitor: string[];
  investigationPath: ToolCall[];
  previousComparison: string;
}

// 8 Status Stepper Pipeline
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
  const id = params?.id || "ticker";
  const navigate = useNavigate();

  // 1. Live SSE Stream Connection dari /api/investigations/:id/events
  const { eventData, isConnected } = useInvestigationSSE(id);

  // 2. State Laporan Akhir
  const [summaryData, setSummaryData] = useState<InvestigationData | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentStatusIdx = PIPELINE_STEPS.findIndex((s) => s.status === eventData.status);
  const isFailed = eventData.status === "failed";
  const isCompleted = eventData.status === "completed" || summaryData?.status === "COMPLETED";

  // Handler manual untuk tombol muat ulang
  const handleRetry = () => {
    setIsFetchingSummary(true);
    setFetchError(null);
    void fetch(`/api/investigations/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Gagal mengambil data dari API (HTTP ${res.status})`);
        }
        return res.json() as Promise<InvestigationData>;
      })
      .then((data) => {
        setSummaryData(data);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : "Data laporan investigasi belum siap dari server API.";
        console.error("Error fetching investigation summary:", err);
        setFetchError(message);
      })
      .finally(() => {
        setIsFetchingSummary(false);
      });
  };

  // Auto-fetch asinkron saat SSE selesai tanpa memicu re-render
  useEffect(() => {
    let ignore = false;

    if ((eventData.status === "completed" || isCompleted) && !summaryData && !isFetchingSummary) {
      Promise.resolve().then(() => {
        if (ignore) return;
        setIsFetchingSummary(true);
        setFetchError(null);

        void fetch(`/api/investigations/${id}`)
          .then((res) => {
            if (!res.ok) {
              throw new Error(`Gagal mengambil data dari API (HTTP ${res.status})`);
            }
            return res.json() as Promise<InvestigationData>;
          })
          .then((data) => {
            if (!ignore) {
              setSummaryData(data);
            }
          })
          .catch((err: unknown) => {
            if (!ignore) {
              const message =
                err instanceof Error
                  ? err.message
                  : "Data laporan investigasi belum siap dari server API.";
              console.error("Error fetching investigation summary:", err);
              setFetchError(message);
            }
          })
          .finally(() => {
            if (!ignore) {
              setIsFetchingSummary(false);
            }
          });
      });
    }

    return () => {
      ignore = true;
    };
  }, [eventData.status, id, isCompleted, summaryData, isFetchingSummary]);

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
            ← Kembali ke Dashboard
          </Button>
          <h1 className="dashboard-title">
            Investigasi Ticker: <span className="uppercase text-primary">{id}</span>
          </h1>
        </div>

        {/* Live SSE Status Badge */}
        <div className="flex items-center gap-2 border border-border/40 px-3 py-1.5 rounded-full bg-panel/60">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-xs font-mono text-muted-foreground">
            {isConnected ? "Live Stream Active" : "Stream Disconnected"}
          </span>
        </div>
      </div>

      {/* SECTION 1: LIVE INVESTIGATION PROGRESS STEPPER (8 STATUS) */}
      <section className="dashboard-panel space-y-6">
        <div>
          <h2 className="panel-title">Investigation Progress</h2>
          <p className="panel-subtitle">
            Tracking real-time eksekusi pipeline agent untuk ticker{" "}
            <strong className="uppercase">{id}</strong>.
          </p>
        </div>

        {/* Progress Stepper Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCurrent = eventData.status === step.status;
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
                  {isDone ? "✓" : idx + 1}
                </span>
                <span className="line-clamp-1">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Active Tool Call & Reason Box */}
        {eventData.currentTool && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-primary font-bold">
              🛠 Active Tool Executing
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
            <h4 className="text-sm font-bold text-rose-400">⚠️ Pipeline Execution Failed</h4>
            <p className="text-xs font-mono text-rose-300">
              {eventData.error || "Terjadi kesalahan pada eksekusi agen."}
            </p>
          </div>
        )}
      </section>

      {/* SECTION 2: INDIKATOR MEMUAT LAPORAN ATAU ERROR HANDLER */}
      {isCompleted && !summaryData && (
        <div className="dashboard-panel text-center py-8 space-y-3">
          {isFetchingSummary ? (
            <p className="text-sm font-mono text-primary animate-pulse">
              ⏳ Memuat laporan sintesis hasil investigasi dari backend API...
            </p>
          ) : fetchError ? (
            <div className="space-y-3">
              <p className="text-xs font-mono text-amber-400">{fetchError}</p>
              <Button size="sm" variant="outline" onClick={handleRetry}>
                🔄 Coba Muat Ulang Laporan API
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
                content={summaryData.evidence?.priceVolume}
                icon="📈"
              />
              <EvidenceCard
                title="Market Context"
                content={summaryData.evidence?.market}
                icon="🌐"
              />
              <EvidenceCard
                title="Sector Context"
                content={summaryData.evidence?.sector}
                icon="🏭"
              />
              <EvidenceCard
                title="Foreign Flow"
                content={summaryData.evidence?.foreignFlow}
                icon="💵"
              />
              <EvidenceCard
                title="Broker Activity"
                content={summaryData.evidence?.broker}
                icon="🏛"
              />
              <EvidenceCard title="News Sentiment" content={summaryData.evidence?.news} icon="📰" />
              <EvidenceCard
                title="Official Filing"
                content={summaryData.evidence?.filing}
                icon="📄"
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

          {/* Investigation Path Timeline */}
          <section className="dashboard-panel space-y-4">
            <h2 className="panel-title">Investigation Path Execution Log</h2>

            <div className="divide-y divide-border/40">
              {summaryData.investigationPath?.map((tool, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{tool.toolName}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400">
                        {tool.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{tool.reason}</p>
                  </div>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {tool.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </section>

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
function EvidenceCard({ title, content, icon }: { title: string; content?: string; icon: string }) {
  if (!content) return null;
  return (
    <div className="dashboard-panel flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
        <span>{icon}</span>
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
