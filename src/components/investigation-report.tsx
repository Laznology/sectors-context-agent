import { EvidencePanel } from "@/components/evidence-panel";
import { InvestigationPath } from "@/components/investigation-path";
import { InvestigationTimeline } from "@/components/investigation-timeline";
import { Button } from "@/components/ui/button";
import type { InvestigationData, LikelyDriver } from "@/lib/investigation-view-model";
import {
  CONFIDENCE_TEXT,
  DRIVER_TEXT,
  INVESTIGATION_DISCLAIMER,
} from "@/shared/schemas/investigation.ts";
import { RefreshCw } from "lucide-react";

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
 * Driver, confidence, and the basis for that confidence as one verdict, so the
 * answer lands before the reader scrolls. Every line is derived from the run
 * data: no claim here goes beyond what the agent reported.
 */
function Verdict({ data, showConfidence }: { data: InvestigationData; showConfidence: boolean }) {
  const total = data.evidenceCards.length;
  const collected = data.evidenceCards.filter((card) => card.finding !== null);
  const silent = data.evidenceCards.filter((card) => card.finding === null).map((c) => c.label);
  const partial = collected.length > 0 && silent.length > 0;

  return (
    <div className="border-rule grid grid-cols-1 gap-6 border-b pb-6 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:items-center lg:gap-x-8">
      {/* The two verdict values share one baseline and one bottom edge; the reason
          takes the whole remaining width instead of a narrow strip. */}
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <h3 className={VERDICT_LABEL}>Penyebab pergerakan</h3>
          <span
            className={`inline-flex rounded-lg border px-4 py-2 font-serif text-2xl font-bold tracking-tight uppercase ${DRIVER_STYLE[data.likelyDriver]}`}
          >
            {DRIVER_TEXT[data.likelyDriver]}
          </span>
        </div>

        {showConfidence && (
          <div className="flex flex-col gap-2">
            <h3 className={VERDICT_LABEL}>Keyakinan</h3>
            <span
              className={`badge mt-auto w-fit px-3.5 py-2 text-sm ${CONFIDENCE_CLASS[data.confidence]}`}
            >
              {CONFIDENCE_TEXT[data.confidence]}
            </span>
          </div>
        )}
      </div>

      {showConfidence && (
        <div className="space-y-3 lg:border-rule lg:border-l lg:pl-8">
          {collected.length > 0 && (
            <p className="text-foreground/70 text-xs leading-relaxed text-pretty">
              Berdasarkan {collected.length} dari {total} kategori bukti yang menghasilkan temuan.
            </p>
          )}
          {data.confidenceReason && (
            <p className="text-foreground/90 max-w-[68ch] text-base leading-relaxed text-pretty">
              {data.confidenceReason}
            </p>
          )}
          {partial && (
            <p className="text-muted-foreground max-w-[68ch] text-xs leading-relaxed text-pretty">
              Belum terdukung: {silent.join(", ")}.
            </p>
          )}
        </div>
      )}
    </div>
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
      <section className="dashboard-panel space-y-6">
        <div>
          <h2 className="panel-title">
            <span className="tabular">{data.ticker}</span> - Ringkasan Eksekutif
          </h2>
          {data.question && (
            <p className="text-muted-foreground mt-1 text-xs italic">"{data.question}"</p>
          )}
        </div>

        <Verdict data={data} showConfidence={data.status === "COMPLETED"} />

        {data.status === "FAILED" ? (
          <div className="space-y-4">
            <p className="text-destructive text-sm leading-relaxed">
              Investigasi ini tidak selesai, jadi belum ada penjelasan yang bisa ditampilkan.
            </p>
            {onReinvestigate && (
              <Button type="button" onClick={onReinvestigate} className="w-fit">
                <RefreshCw aria-hidden />
                Jalankan lagi
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-signal-text font-mono text-xs font-bold tracking-wider uppercase">
                  Apa yang Berubah?
                </h3>
                <p className="text-foreground/90 max-w-[68ch] text-base leading-relaxed">
                  {data.whatChanged}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-ink/85 font-mono text-xs font-bold tracking-wider uppercase">
                  Mengapa Ini Penting?
                </h3>
                <p className="text-foreground/90 max-w-[68ch] text-base leading-relaxed">
                  {data.whyItMatters}
                </p>
              </div>
            </div>

            <div className="border-rule space-y-2 border-t pt-3">
              <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
                Penjelasan Lengkap
              </h3>
              <p className="text-foreground/80 max-w-[68ch] text-base leading-relaxed">
                {data.explanation}
              </p>
            </div>
          </>
        )}
      </section>

      {data.investigationPath.length > 0 && (
        <section className="dashboard-panel space-y-4">
          <div>
            <h2 className="panel-title">Jejak Investigasi</h2>
            <p className="panel-subtitle">
              Langkah yang diambil agent, berurutan, beserta temuan tiap langkah.
            </p>
          </div>
          <InvestigationPath steps={data.investigationPath} />
        </section>
      )}

      {data.evidenceCards.some((card) => card.finding !== null) && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold tracking-tight">Kartu Bukti</h2>
          <EvidencePanel cards={data.evidenceCards} />
        </section>
      )}
      {data.timeline.length > 0 && (
        <section className="dashboard-panel space-y-4">
          <div>
            <h2 className="panel-title">Riwayat</h2>
            <p className="panel-subtitle">
              Investigasi sebelumnya untuk ticker ini, terbaru lebih dulu, beserta perubahannya
              sejak investigasi sebelumnya.
            </p>
          </div>
          <InvestigationTimeline entries={data.timeline} ticker={data.ticker} />
        </section>
      )}

      {data.status === "COMPLETED" && (
        <>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">Yang Perlu Dipantau</h3>
              {data.whatToMonitor.length > 0 ? (
                <ul className="text-foreground/90 list-inside list-disc max-w-[68ch] space-y-2 text-sm">
                  {data.whatToMonitor.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Tidak ada hal yang perlu dipantau.</p>
              )}
            </div>

            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">Perbandingan dengan Investigasi Sebelumnya</h3>
              <p className="text-muted-foreground max-w-[68ch] text-sm leading-relaxed">
                {data.previousComparison || "Belum ada investigasi sebelumnya untuk ticker ini."}
              </p>
            </div>
          </section>

          <footer className="border-rule border-t pt-4 text-center">
            <p className="text-muted-foreground font-mono text-xs italic">
              Disclaimer: {INVESTIGATION_DISCLAIMER}
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
