import { ChatPanel } from "@/components/chat-panel";
import { InvestigationReport, InvestigationVerdict } from "@/components/investigation-report";
import { Button } from "@/components/ui/button";
import {
  resolvePageStage,
  toInvestigationData,
  toolLabel,
  type InvestigationData,
  type InvestigationDetailResponse,
  type StatusLabel,
} from "@/lib/investigation-view-model";
import { SessionGuard } from "@/lib/session";
import { useInvestigationSSE, type PipelineStatus } from "@/lib/use-investigation-sse";
import { rootRoute } from "@/routes/__root";
import { PIPELINE_STEP_TEXT, STATUS_LABEL_TEXT } from "@/shared/schemas/investigation.ts";
import { createRoute, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const investigationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/investigations/$ticker",
  component: InvestigationDetailPage,
});

/** Ordered stages of the run; the labels live in the shared schema so no surface re-invents them. */
const AS_OF_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const PIPELINE_STEPS: PipelineStatus[] = [
  "pending",
  "collecting_baseline",
  "calculating_signals",
  "planning",
  "investigating",
  "synthesizing",
  "completed",
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
  const [reloadToken, setReloadToken] = useState(0);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const isChatOpen = summaryData?.status === "COMPLETED" && openChatId === summaryData.id;
  const loadingRef = useRef<HTMLDivElement | null>(null);

  const currentStatusIdx = PIPELINE_STEPS.indexOf(eventData.status);
  const isTerminal = eventData.status === "completed" || eventData.status === "failed";

  const reload = () => {
    // Reloading unmounts the retry button that was just pressed; move focus to
    // the stage it belongs to instead of letting it fall back to the document.
    loadingRef.current?.focus();
    setIsFetchingSummary(true);
    setFetchError(null);
    setReloadToken((token) => token + 1);
  };

  const handleReinvestigate = async (targetTicker: string) => {
    setOpenChatId(null);
    try {
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: targetTicker }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Investigasi gagal dimulai (HTTP ${res.status})`);
      }
      setSummaryData(null);
      setNotFound(false);
      setFetchError(null);
      reload();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Investigasi gagal dimulai.");
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
          throw new Error(`Gagal memuat data dari API (HTTP ${res.status})`);
        }
        return toInvestigationData((await res.json()) as InvestigationDetailResponse);
      })
      .then((data) => {
        if (!ignore && data) setSummaryData(data);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        const message =
          err instanceof Error ? err.message : "Laporan investigasi belum tersedia dari API.";
        console.error("Gagal memuat ringkasan investigasi:", err);
        setFetchError(message);
      })
      .finally(() => {
        if (!ignore) setIsFetchingSummary(false);
      });

    return () => {
      ignore = true;
    };
  }, [ticker, isTerminal, reloadToken]);

  const stage = resolvePageStage({
    status: summaryData?.status ?? null,
    isFetching: isFetchingSummary,
    error: fetchError,
    notFound,
  });

  return (
    <div
      className={`dashboard-wrapper space-y-8 ${
        isChatOpen ? "xl:max-w-none xl:pl-6 xl:pr-[39rem]" : ""
      }`}
    >
      <div className="border-rule flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
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
            Kembali ke dasbor
          </Button>
          <h1 className="dashboard-title">
            <span className="text-signal-text uppercase">{summaryData?.ticker || ticker}</span>
          </h1>
          {summaryData?.companyName && (
            <p className="text-foreground/80 text-sm">{summaryData.companyName}</p>
          )}
          {summaryData?.asOfDate && (
            <p className="text-muted-foreground text-xs">
              Data sampai {AS_OF_DATE_FORMAT.format(new Date(`${summaryData.asOfDate}T00:00:00Z`))},
              penutupan harian
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          {summaryData?.status === "COMPLETED" && (
            <Button
              type="button"
              size="sm"
              variant={isChatOpen ? "secondary" : "outline"}
              aria-expanded={isChatOpen}
              onClick={() => setOpenChatId(isChatOpen ? null : summaryData.id)}
            >
              {isChatOpen ? <X aria-hidden /> : <MessageSquare aria-hidden />}
              {isChatOpen ? "Tutup chat" : "Tanya agent"}
            </Button>
          )}
          {summaryData && <StatusLabelBadge label={summaryData.statusLabel} />}
        </div>
      </div>

      {stage === "report" && summaryData?.status === "COMPLETED" && (
        <ChatPanel
          key={`${summaryData.id}-${summaryData.status}`}
          investigationId={summaryData.id}
          ticker={summaryData.ticker || ticker}
          initialMessages={summaryData.conversation}
          isOpen={isChatOpen}
          onClose={() => setOpenChatId(null)}
        />
      )}

      {/* Persistent wrapper: React swaps the child inside it, so a live run resolves
          into the report in place instead of remounting the whole subtree. */}
      <div className="animate-in fade-in flex min-h-0 flex-col gap-8 duration-500">
        {stage === "loading" && (
          <div
            ref={loadingRef}
            tabIndex={-1}
            className="dashboard-panel space-y-3 py-8 text-center"
          >
            {isFetchingSummary ? (
              <p
                role="status"
                className="text-signal-text flex items-center justify-center gap-2 font-mono text-sm"
              >
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Memuat laporan investigasi…
              </p>
            ) : (
              <div className="space-y-3">
                <p role="alert" className="text-destructive font-mono text-xs">
                  {fetchError}
                </p>
                <Button size="sm" variant="outline" onClick={reload}>
                  <RefreshCw aria-hidden />
                  Coba muat ulang
                </Button>
              </div>
            )}
          </div>
        )}

        {stage === "empty" && (
          <div className="dashboard-panel space-y-4 py-10 text-center">
            <p className="text-foreground font-medium">
              Belum ada investigasi untuk{" "}
              <span className="text-signal-text uppercase">{ticker}</span>.
            </p>
            <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
              Jalankan investigasi pertama, lalu agent akan mengumpulkan bukti pasar, sektor, aliran
              dana asing, broker, dan berita, lalu menjelaskan apa yang bergerak.
            </p>
            <Button
              type="button"
              onClick={() => void handleReinvestigate(ticker)}
              className="mx-auto w-fit"
            >
              Investigasi {ticker}
            </Button>
          </div>
        )}

        {stage === "progress" && (
          <section className="dashboard-panel space-y-6">
            <div>
              <h2 className="panel-title">Progres Investigasi</h2>
              <p className="panel-subtitle">
                Progres langsung pipeline agent untuk ticker{" "}
                <strong className="uppercase">{summaryData?.ticker || ticker}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {PIPELINE_STEPS.map((status, idx) => {
                const isCurrent = eventData.status === status && status !== "completed";
                const isDone = currentStatusIdx > idx || eventData.status === "completed";

                return (
                  <div
                    key={status}
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
                          ? "bg-signal text-signal-ink ring-4 ring-signal/20"
                          : isDone
                            ? "bg-signal/70 font-bold text-ink"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="size-3" aria-hidden /> : idx + 1}
                    </span>
                    <span className="line-clamp-1">{PIPELINE_STEP_TEXT[status]}</span>
                  </div>
                );
              })}
            </div>

            {eventData.currentTool && !isTerminal && (
              <div className="border-rule bg-ink/4 space-y-2 rounded-lg border p-4">
                <span className="text-signal-text flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider uppercase">
                  <Wrench className="size-3.5" aria-hidden />
                  Alat aktif
                </span>
                <p className="text-foreground text-sm font-bold">
                  {toolLabel(eventData.currentTool.toolName)}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <strong className="text-foreground">Alasan: </strong>
                  {eventData.currentTool.reason}
                </p>
              </div>
            )}

            {eventData.status === "failed" && (
              <div className="border-destructive/50 bg-destructive/10 space-y-1 rounded-lg border p-4">
                <h4 className="text-destructive flex items-center gap-1.5 text-sm font-bold">
                  <TriangleAlert className="size-4" aria-hidden />
                  Eksekusi pipeline gagal
                </h4>
                <p className="text-destructive/90 font-mono text-xs">
                  {eventData.error || "Proses agent gagal."}
                </p>
              </div>
            )}
          </section>
        )}

        {stage === "report" && summaryData && (
          <main className="min-w-0 space-y-6">
            <InvestigationVerdict data={summaryData} />
            <InvestigationReport
              data={summaryData}
              onReinvestigate={() => void handleReinvestigate(summaryData.ticker || ticker)}
            />
          </main>
        )}
      </div>
    </div>
  );
}

const STATUS_BADGE_CLASS: Record<StatusLabel, string> = {
  NORMAL: "badge-ink",
  ATTENTION: "badge-signal",
  UNCLEAR: "badge-muted",
};

function StatusLabelBadge({ label }: { label: StatusLabel | null }) {
  if (!label) return null;
  const text = STATUS_LABEL_TEXT[label.toLowerCase() as keyof typeof STATUS_LABEL_TEXT];

  return (
    <span
      className={`badge ${STATUS_BADGE_CLASS[label]} shrink-0 font-mono tracking-wider uppercase`}
    >
      {text}
    </span>
  );
}
