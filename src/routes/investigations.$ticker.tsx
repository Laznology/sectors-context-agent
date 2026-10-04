import { ChatPanel } from "@/components/chat-panel";
import { InvestigationReport } from "@/components/investigation-report";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  toInvestigationData,
  toOpeningMessage,
  toolLabel,
  type InvestigationData,
  type InvestigationDetailResponse,
  type StatusLabel,
} from "@/lib/investigation-view-model";
import { SessionGuard } from "@/lib/session";
import { useInvestigationSSE, type PipelineStatus } from "@/lib/use-investigation-sse";
import { rootRoute } from "@/routes/__root";
import { createRoute, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  FileText,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  Wrench,
} from "lucide-react";
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
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const currentStatusIdx = PIPELINE_STEPS.findIndex((s) => s.status === eventData.status);
  const isFailed = eventData.status === "failed";
  const isTerminal = eventData.status === "completed" || eventData.status === "failed";

  const reload = () => {
    setIsFetchingSummary(true);
    setFetchError(null);
    setReloadToken((token) => token + 1);
  };

  const handleReinvestigate = async (targetTicker: string) => {
    try {
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: targetTicker }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not start the run (HTTP ${res.status})`);
      }
      setSummaryData(null);
      setNotFound(false);
      setFetchError(null);
      reload();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Could not start the run.");
    }
  };

  useEffect(() => {
    let ignore = false;

    void fetch(`/api/investigations/${ticker}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!ignore) setNotFound(true);
          return null;
        }
        if (!res.ok) {
          throw new Error(`Could not load data from the API (HTTP ${res.status})`);
        }
        return toInvestigationData((await res.json()) as InvestigationDetailResponse);
      })
      .then((data) => {
        if (!ignore && data) setSummaryData(data);
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

      {!hasReport && !notFound && (
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
              const isCurrent =
                eventData.status === step.status && eventData.status !== "completed";
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
      )}

      {!summaryData && !notFound && (isFetchingSummary || fetchError) && (
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

      {notFound && (
        <div className="dashboard-panel space-y-4 py-10 text-center">
          <p className="text-foreground font-medium">
            No investigation exists for <span className="text-signal-text uppercase">{ticker}</span>{" "}
            yet.
          </p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
            Start the first run and the agent will collect market, sector, flow, broker, and news
            evidence, then explain what moved.
          </p>
          <Button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="mx-auto w-fit"
          >
            Go to the watchlist to investigate
          </Button>
        </div>
      )}

      {summaryData && !hasReport && (
        <div className="dashboard-panel space-y-2 py-10 text-center">
          <p className="text-signal-text flex items-center justify-center gap-2 font-mono text-sm">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            The agent is collecting evidence
          </p>
          <p className="text-muted-foreground text-sm">
            The report appears here once the investigation completes.
          </p>
        </div>
      )}

      {summaryData && hasReport && (
        <div className="animate-in fade-in flex min-h-0 flex-col gap-4 duration-500">
          <div className="dashboard-panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="panel-title">Conversation</h2>
              <p className="panel-subtitle">
                Ask about this ticker's movement. Answers stay grounded in the collected evidence.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setReportOpen(true)}>
              <FileText aria-hidden />
              Open report
            </Button>
          </div>

          {summaryData.status === "FAILED" ? (
            <div className="dashboard-panel space-y-4">
              <p className="text-destructive text-sm leading-relaxed">
                This investigation did not complete, so there is no result to discuss yet.
              </p>
              <Button
                type="button"
                onClick={() => void handleReinvestigate(summaryData.ticker || ticker)}
                className="w-fit"
              >
                <RefreshCw aria-hidden />
                Run it again
              </Button>
            </div>
          ) : (
            <ChatPanel
              key={`${summaryData.id}-${summaryData.status}`}
              variant="thread"
              investigationId={summaryData.id}
              ticker={summaryData.ticker || ticker}
              openingMessage={toOpeningMessage(summaryData)}
              initialMessages={summaryData.conversation}
              isEnabled
            />
          )}

          <Sheet open={reportOpen} onOpenChange={setReportOpen}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
              <SheetHeader>
                <SheetTitle>{summaryData.ticker} report</SheetTitle>
                <SheetDescription>
                  Evidence, investigation path, Timeline, confidence, and what to monitor.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-8">
                <InvestigationReport
                  data={summaryData}
                  onReinvestigate={() => void handleReinvestigate(summaryData.ticker || ticker)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
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
