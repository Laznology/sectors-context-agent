import { ChatPanel } from "@/components/chat-panel";
import { EvidencePanel } from "@/components/evidence-panel";
import { InvestigationPath } from "@/components/investigation-path";
import { InvestigationTimeline } from "@/components/investigation-timeline";
import { Button } from "@/components/ui/button";
import {
  toInvestigationData,
  toolLabel,
  type InvestigationData,
  type InvestigationDetailResponse,
  type LikelyDriver,
  type StatusLabel,
} from "@/lib/investigation-view-model";
import { SessionGuard } from "@/lib/session";
import { useInvestigationSSE, type PipelineStatus } from "@/lib/use-investigation-sse";
import { rootRoute } from "@/routes/__root";
import { createRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Check, LoaderCircle, RefreshCw, TriangleAlert, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

export const investigationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/investigations/$ticker",
  component: InvestigationDetailPage,
});

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

  const { eventData } = useInvestigationSSE(ticker);

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
          throw new Error(`Could not load data from the API (HTTP ${res.status})`);
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
            : "The investigation report is not ready from the API.";
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

  const hasReport = Boolean(
    summaryData && (summaryData.status === "COMPLETED" || summaryData.status === "FAILED"),
  );

  return (
    <div className="dashboard-wrapper space-y-8 pb-16">
      <div className="border-rule flex items-center justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate({ to: "/" });
            }}
            className="text-muted-foreground -ml-2 w-fit text-xs"
          >
            <ArrowLeft aria-hidden />
            Back to dashboard
          </Button>
          <h1 className="dashboard-title">
            Ticker:{" "}
            <span className="text-signal-text uppercase">{summaryData?.ticker || ticker}</span>
          </h1>
          {summaryData?.companyName && (
            <p className="text-muted-foreground text-sm">{summaryData.companyName}</p>
          )}
        </div>
        {summaryData && <StatusLabelBadge label={summaryData.statusLabel} />}
      </div>

      <section className="dashboard-panel space-y-6">
        <div>
          <h2 className="panel-title">Investigation Progress</h2>
          <p className="panel-subtitle">
            Live progress of the agent pipeline for ticker{" "}
            <strong className="uppercase">{summaryData?.ticker || ticker}</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCurrent = eventData.status === step.status && eventData.status !== "completed";
            const isDone = currentStatusIdx > idx || eventData.status === "completed";

            return (
              <div
                key={step.status}
                className={`flex items-center gap-3 rounded-lg border p-3 text-xs transition-all ${
                  isCurrent
                    ? "border-signal/60 bg-signal/15 text-foreground font-bold"
                    : isDone
                      ? "border-signal/30 bg-signal/8 text-ink/85"
                      : "border-border/40 text-muted-foreground opacity-60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                    isCurrent
                      ? "bg-signal text-signal-ink animate-bounce"
                      : isDone
                        ? "bg-signal/70 font-bold text-ink"
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

        {eventData.currentTool && !isTerminal && (
          <div className="border-rule bg-ink/4 space-y-2 rounded-lg border p-4">
            <span className="text-signal-text flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider uppercase">
              <Wrench className="size-3.5" aria-hidden />
              Active tool
            </span>
            <p className="text-foreground text-sm font-bold">
              {toolLabel(eventData.currentTool.toolName)}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong className="text-foreground">Reason: </strong>
              {eventData.currentTool.reason}
            </p>
          </div>
        )}

        {isFailed && (
          <div className="border-destructive/50 bg-destructive/10 space-y-1 rounded-lg border p-4">
            <h4 className="text-destructive flex items-center gap-1.5 text-sm font-bold">
              <TriangleAlert className="size-4" aria-hidden />
              Pipeline Execution Failed
            </h4>
            <p className="text-destructive/90 font-mono text-xs">
              {eventData.error || "The agent run failed."}
            </p>
          </div>
        )}
      </section>

      {!summaryData && (isFetchingSummary || fetchError) && (
        <div className="dashboard-panel space-y-3 py-8 text-center">
          {isFetchingSummary ? (
            <p className="text-signal-text flex items-center justify-center gap-2 font-mono text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Loading the investigation report…
            </p>
          ) : fetchError ? (
            <div className="space-y-3">
              <p className="text-destructive font-mono text-xs">{fetchError}</p>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw aria-hidden />
                Retry loading report
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {summaryData && !hasReport && (
        <div className="dashboard-panel flex items-center justify-center gap-2 py-10 text-center">
          <LoaderCircle className="text-signal-text size-4 animate-spin" aria-hidden />
          <p className="text-muted-foreground text-sm">
            The agent is collecting evidence. The report appears here once the investigation
            completes.
          </p>
        </div>
      )}

      {summaryData && hasReport && (
        <div className="animate-in fade-in space-y-8 duration-500">
          <section className="dashboard-panel space-y-6">
            <div className="border-rule flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="panel-title">{summaryData.ticker} - Executive Summary</h2>
                {summaryData.question && (
                  <p className="text-muted-foreground mt-1 font-serif text-xs italic">
                    "{summaryData.question}"
                  </p>
                )}
              </div>
              <DriverBadge driver={summaryData.likelyDriver} />
            </div>

            {summaryData.status === "FAILED" ? (
              <p className="text-destructive text-sm leading-relaxed">
                This investigation did not complete, so there is no explanation to show. Run it
                again from the dashboard.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-signal-text font-mono text-xs font-bold tracking-wider uppercase">
                      What Changed?
                    </h3>
                    <p className="text-foreground/90 text-sm leading-relaxed">
                      {summaryData.whatChanged}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-ink/85 font-mono text-xs font-bold tracking-wider uppercase">
                      Why It Matters?
                    </h3>
                    <p className="text-foreground/90 text-sm leading-relaxed">
                      {summaryData.whyItMatters}
                    </p>
                  </div>
                </div>

                <div className="border-rule space-y-2 border-t pt-3">
                  <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
                    Detailed Explanation
                  </h3>
                  <p className="text-foreground/80 text-sm leading-relaxed">
                    {summaryData.explanation}
                  </p>
                </div>
              </>
            )}
          </section>

          {summaryData.evidenceCards.some((card) => card.finding !== null) && (
            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold tracking-tight">Evidence Cards</h2>
              <EvidencePanel cards={summaryData.evidenceCards} />
            </section>
          )}

          {summaryData.timeline.length > 0 && (
            <section className="dashboard-panel space-y-4">
              <div>
                <h2 className="panel-title">Timeline</h2>
                <p className="panel-subtitle">
                  Previous runs for this ticker, newest first, with what changed since the run
                  before.
                </p>
              </div>
              <InvestigationTimeline
                entries={summaryData.timeline}
                ticker={summaryData.ticker || ticker}
              />
            </section>
          )}

          {summaryData.investigationPath.length > 0 && (
            <section className="dashboard-panel space-y-4">
              <div>
                <h2 className="panel-title">Investigation Path</h2>
                <p className="panel-subtitle">
                  The steps the agent took, in order, with what each one found.
                </p>
              </div>
              <InvestigationPath steps={summaryData.investigationPath} />
            </section>
          )}

          {summaryData.status === "COMPLETED" && (
            <>
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="dashboard-panel space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="panel-title">Confidence</h3>
                    <ConfidenceBadge level={summaryData.confidence} />
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {summaryData.confidenceReason}
                  </p>
                </div>

                <div className="dashboard-panel space-y-3">
                  <h3 className="panel-title">What to Monitor</h3>
                  {summaryData.whatToMonitor.length > 0 ? (
                    <ul className="text-foreground/90 list-inside list-disc space-y-2 text-xs">
                      {summaryData.whatToMonitor.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No monitoring items were reported.
                    </p>
                  )}
                </div>

                <div className="dashboard-panel space-y-3">
                  <h3 className="panel-title">Previous Comparison</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {summaryData.previousComparison || "No previous investigation for this ticker."}
                  </p>
                </div>
              </section>

              <ChatPanel
                key={`${summaryData.id}-${summaryData.status}`}
                investigationId={summaryData.id}
                ticker={summaryData.ticker || ticker}
                initialMessages={summaryData.conversation}
                isEnabled
              />

              <footer className="border-rule border-t pt-4 text-center">
                <p className="text-muted-foreground font-mono text-xs italic">
                  Disclaimer: This analysis is informational and does not constitute investment
                  advice.
                </p>
              </footer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const DRIVER_STYLE: Record<LikelyDriver, string> = {
  MARKET_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  SECTOR_DRIVEN: "border-ink/25 bg-ink/10 text-ink",
  FLOW_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  COMPANY_SPECIFIC: "border-ink/25 bg-ink/10 text-ink",
  MIXED: "border-signal/45 bg-signal/20 text-ink",
  UNCLEAR: "border-border/60 bg-muted/40 text-muted-foreground",
};

function DriverBadge({ driver }: { driver?: LikelyDriver }) {
  if (!driver) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${DRIVER_STYLE[driver]}`}
    >
      {driver.replace(/_/g, " ")}
    </span>
  );
}

const STATUS_LABEL_STYLE: Record<StatusLabel, { className: string; text: string }> = {
  NORMAL: { className: "badge-ink", text: "Normal" },
  ATTENTION: { className: "badge-signal", text: "Needs Attention" },
  UNCLEAR: { className: "badge-muted", text: "Unclear" },
};

function StatusLabelBadge({ label }: { label: StatusLabel | null }) {
  if (!label) return null;
  const style = STATUS_LABEL_STYLE[label];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${style.className}`}
    >
      {style.text}
    </span>
  );
}

function ConfidenceBadge({ level }: { level?: InvestigationData["confidence"] }) {
  if (!level) return null;
  const styles = {
    HIGH: "badge-signal",
    MEDIUM: "badge-ink",
    LOW: "badge-muted",
  };

  return <span className={`badge ${styles[level]}`}>{level} Confidence</span>;
}
