import { EvidencePanel } from "@/components/evidence-panel";
import { InvestigationPath } from "@/components/investigation-path";
import { InvestigationSignalChart } from "@/components/investigation-signal-chart";
import { InvestigationTimeline } from "@/components/investigation-timeline";
import { Button } from "@/components/ui/button";
import type { InvestigationData, LikelyDriver } from "@/lib/investigation-view-model";
import {
  CONFIDENCE_TEXT,
  DRIVER_TEXT,
  INVESTIGATION_DISCLAIMER,
} from "@/shared/schemas/investigation.ts";
import { ChevronDown, RefreshCw } from "lucide-react";
const NUMBER = new Intl.NumberFormat("id-ID");
const PERCENT = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 2,
});
const POINTS = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DRIVER_STYLE: Record<LikelyDriver, string> = {
  MARKET_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  SECTOR_DRIVEN: "border-ink/25 bg-ink/10 text-ink",
  FLOW_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  COMPANY_SPECIFIC: "border-ink/25 bg-ink/10 text-ink",
  MIXED: "border-signal/45 bg-signal/20 text-ink",
  UNCLEAR: "border-border/60 bg-muted/40 text-muted-foreground",
};

const CONFIDENCE_CLASS: Record<NonNullable<InvestigationData["confidence"]>, string> = {
  HIGH: "badge-signal",
  MEDIUM: "badge-ink",
  LOW: "badge-muted",
};

const VERDICT_LABEL = "text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase";

/**
 * Disclosure row styling for the long-form sections. The chevron plus the
 * platform's own open/close semantics are the whole affordance: no component
 * state, no hand-written ARIA, so keyboard and screen readers already work.
 */
const DISCLOSURE_SUMMARY =
  "hover:text-foreground flex w-full cursor-pointer list-none items-center gap-2 text-left text-muted-foreground transition-colors [&::-webkit-details-marker]:hidden";

const DISCLOSURE_LABEL = "font-mono text-xs font-bold tracking-wider uppercase";

const DISCLOSURE_COUNT =
  "text-muted-foreground/80 ml-auto font-mono text-[11px] tracking-wider whitespace-nowrap uppercase";

const CHEVRON = "size-3.5 shrink-0 transition-transform group-open:rotate-180";

/**
 * The answer leads. The plain-language sentence is the largest prose on the page,
 * because a retail investor should be able to stop reading there; the driver and
 * confidence badges are the classification of that sentence, not the answer
 * itself. Exported on its own so the page can slot the follow-up chat directly
 * after the verdict. Every line is derived from the run data: no claim here goes
 * beyond what the agent reported.
 */
export function InvestigationVerdict({ data }: { data: InvestigationData }) {
  const showConfidence = data.status === "COMPLETED";
  const total = data.evidenceCards.length;
  const collected = data.evidenceCards.filter((card) => card.finding !== null);
  const silent = data.evidenceCards.filter((card) => card.finding === null).map((c) => c.label);
  const partial = collected.length > 0 && silent.length > 0;

  return (
    <section className="dashboard-panel space-y-6">
      <div>
        <h2 className="panel-title">
          <span className="tabular">{data.ticker}</span> - Ringkasan Eksekutif
        </h2>
        {data.question && (
          <p className="text-muted-foreground mt-1 text-xs italic">"{data.question}"</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-lg border px-3 py-1.5 font-serif text-lg font-bold tracking-tight uppercase ${DRIVER_STYLE[data.likelyDriver]}`}
        >
          {DRIVER_TEXT[data.likelyDriver]}
        </span>
        {showConfidence && (
          <span className={`badge px-3 py-1.5 text-xs ${CONFIDENCE_CLASS[data.confidence]}`}>
            Keyakinan {CONFIDENCE_TEXT[data.confidence]}
          </span>
        )}
        {collected.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {collected.length}/{total} kategori bukti
          </span>
        )}
      </div>

      {summaryFromSignals(data) && (
        <p className="text-foreground max-w-[68ch] text-lg leading-relaxed text-pretty">
          {summaryFromSignals(data)}
        </p>
      )}

      <InvestigationSignalChart ticker={data.ticker} signals={data.signals} />

      {collected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <h3 className={VERDICT_LABEL}>Diperiksa</h3>
          {collected.map((card) => (
            <span key={card.type} className="badge badge-ink">
              {card.label}
            </span>
          ))}
        </div>
      )}

      {showConfidence && (
        <div className="space-y-4">
          {data.whatToMonitor.length > 0 && (
            <div className="border-rule border-t pt-4">
              <h3 className={VERDICT_LABEL}>Yang perlu dipantau</h3>
              <ul className="text-foreground/90 mt-2 list-inside list-disc max-w-[68ch] space-y-1 text-sm">
                <li className="leading-relaxed">{data.whatToMonitor[0]}</li>
              </ul>
              {data.whatToMonitor.length > 1 && (
                <details className="group mt-2">
                  <summary className={DISCLOSURE_SUMMARY}>
                    <ChevronDown className={CHEVRON} aria-hidden />
                    <span className={DISCLOSURE_LABEL}>Pantauan lainnya</span>
                    <span className={DISCLOSURE_COUNT}>{data.whatToMonitor.length - 1} item</span>
                  </summary>
                  <ul className="text-foreground/90 mt-2 list-inside list-disc max-w-[68ch] space-y-1 text-sm">
                    {data.whatToMonitor.slice(1).map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {partial && (
            <details className="group border-rule border-t pt-3">
              <summary className={DISCLOSURE_SUMMARY}>
                <ChevronDown className={CHEVRON} aria-hidden />
                <span className={DISCLOSURE_LABEL}>Data belum tersedia</span>
                <span className={DISCLOSURE_COUNT}>{silent.length} kategori</span>
              </summary>
              <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-relaxed">
                {silent.join(", ")}
              </p>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

export function InvestigationReport({
  data,
  onReinvestigate,
}: {
  data: InvestigationData;
  onReinvestigate?: () => void;
}) {
  return (
    <div className="space-y-8">
      {data.status === "FAILED" ? (
        <section className="dashboard-panel space-y-4">
          <p className="text-destructive text-sm leading-relaxed">
            Investigasi ini tidak selesai, jadi belum ada penjelasan yang bisa ditampilkan.
          </p>
          {onReinvestigate && (
            <Button type="button" onClick={onReinvestigate} className="w-fit">
              <RefreshCw aria-hidden />
              Jalankan lagi
            </Button>
          )}
        </section>
      ) : (
        <details className="dashboard-panel group space-y-4">
          <summary className={DISCLOSURE_SUMMARY}>
            <ChevronDown className={CHEVRON} aria-hidden />
            <span className={DISCLOSURE_LABEL}>Detail analisis</span>
            <span className={DISCLOSURE_COUNT}>
              {NUMBER.format(countWords(data.explanation))} kata
            </span>
          </summary>
          {data.confidenceReason && (
            <div className="space-y-2 border-t border-rule pt-4">
              <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
                Dasar keyakinan
              </h3>
              <p className="text-foreground/80 max-w-[68ch] text-sm leading-relaxed">
                {data.confidenceReason}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 border-t border-rule pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-signal-text font-mono text-xs font-bold tracking-wider uppercase">
                Apa yang berubah?
              </h3>
              <p className="text-foreground/90 max-w-[68ch] text-sm leading-relaxed">
                {data.whatChanged}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-ink/85 font-mono text-xs font-bold tracking-wider uppercase">
                Mengapa penting?
              </h3>
              <p className="text-foreground/90 max-w-[68ch] text-sm leading-relaxed">
                {data.whyItMatters}
              </p>
            </div>
          </div>
          <div className="border-t border-rule pt-4">
            <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
              Penjelasan lengkap
            </h3>
            <p className="text-foreground/80 mt-2 max-w-[68ch] text-sm leading-relaxed">
              {data.explanation}
            </p>
          </div>
        </details>
      )}

      {data.investigationPath.length > 0 && (
        <section className="dashboard-panel space-y-4">
          <div>
            <h2 className="panel-title">Jejak Investigasi</h2>
            <p className="panel-subtitle">
              Sumber yang dipilih agent, alasan pemilihan, dan temuan tiap langkah.
            </p>
          </div>
          <details className="group border-rule border-t pt-3">
            <summary className={DISCLOSURE_SUMMARY}>
              <ChevronDown className={CHEVRON} aria-hidden />
              <span className={DISCLOSURE_LABEL}>Langkah Agent</span>
              <span className={DISCLOSURE_COUNT}>{data.investigationPath.length} langkah</span>
            </summary>
            <InvestigationPath steps={data.investigationPath} />
          </details>
        </section>
      )}

      {data.evidenceCards.some((card) => card.finding !== null) && (
        <section className="dashboard-panel space-y-3">
          <details className="group">
            <summary className={DISCLOSURE_SUMMARY}>
              <ChevronDown className={CHEVRON} aria-hidden />
              <span className={DISCLOSURE_LABEL}>Bukti yang mendukung analisis</span>
              <span className={DISCLOSURE_COUNT}>
                {data.evidenceCards.filter((card) => card.finding !== null).length} temuan
              </span>
            </summary>
            <EvidencePanel cards={data.evidenceCards} />
          </details>
        </section>
      )}

      {(data.timeline.length > 0 || data.status === "COMPLETED") && (
        <details className="dashboard-panel group space-y-4">
          <summary className={DISCLOSURE_SUMMARY}>
            <ChevronDown className={CHEVRON} aria-hidden />
            <span className={DISCLOSURE_LABEL}>Riwayat ticker</span>
            <span className={DISCLOSURE_COUNT}>
              {data.timeline.length > 0
                ? `${data.timeline.length} investigasi`
                : "Belum ada riwayat"}
            </span>
          </summary>
          <div className="space-y-4 border-t border-rule pt-4">
            {data.status === "COMPLETED" && (
              <p className="text-muted-foreground max-w-[68ch] text-sm leading-relaxed">
                {data.previousComparison || "Belum ada investigasi sebelumnya untuk ticker ini."}
              </p>
            )}
            {data.timeline.length > 0 && (
              <InvestigationTimeline entries={data.timeline} ticker={data.ticker} />
            )}
          </div>
        </details>
      )}

      {data.status === "COMPLETED" && (
        <>
          <footer className="border-rule border-t pt-4 text-center">
            <p className="text-muted-foreground font-mono text-xs italic">
              Data pasar mengikuti penutupan harian, bukan data real-time.
            </p>
            <p className="text-muted-foreground mt-2 font-mono text-xs italic">
              Disclaimer: {INVESTIGATION_DISCLAIMER}
            </p>
          </footer>
        </>
      )}
    </div>
  );
}

/** Real length of the narrative behind its disclosure, so the summary can state it. */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function summaryFromSignals(data: InvestigationData): string {
  const signals = data.signals;
  if (!signals) return data.confidenceReason;

  const parts: string[] = [];
  if (signals.dailyReturn !== null) {
    const direction = signals.dailyReturn < 0 ? "turun" : "naik";
    const move = `${data.ticker} ${direction} ${PERCENT.format(Math.abs(signals.dailyReturn))}`;
    if (signals.relativeReturn === null) {
      parts.push(`${move} pada sesi terakhir`);
    } else if (signals.relativeReturn > 0) {
      parts.push(
        `${move}, mengungguli IHSG sebesar ${POINTS.format(signals.relativeReturn * 100)} poin persentase`,
      );
    } else if (signals.relativeReturn < 0) {
      parts.push(
        `${move}, tertinggal dari IHSG sebesar ${POINTS.format(Math.abs(signals.relativeReturn) * 100)} poin persentase`,
      );
    } else {
      parts.push(`${move}, sejalan dengan IHSG`);
    }
  }
  if (signals.volumeRatio !== null) {
    parts.push(`volume ${NUMBER.format(signals.volumeRatio)}× rata-rata`);
  }

  return parts.length > 0 ? `${parts.join("; ")}.` : data.confidenceReason;
}
