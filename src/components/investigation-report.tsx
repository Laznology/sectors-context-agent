import { EvidencePanel } from "@/components/evidence-panel";
import { InvestigationPath } from "@/components/investigation-path";
import { InvestigationTimeline } from "@/components/investigation-timeline";
import { Button } from "@/components/ui/button";
import type { InvestigationData, LikelyDriver } from "@/lib/investigation-view-model";
import { RefreshCw } from "lucide-react";

const DRIVER_STYLE: Record<LikelyDriver, string> = {
  MARKET_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  SECTOR_DRIVEN: "border-ink/25 bg-ink/10 text-ink",
  FLOW_DRIVEN: "border-signal/45 bg-signal/20 text-ink",
  COMPANY_SPECIFIC: "border-ink/25 bg-ink/10 text-ink",
  MIXED: "border-signal/45 bg-signal/20 text-ink",
  UNCLEAR: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function DriverBadge({ driver }: { driver?: LikelyDriver }) {
  if (!driver) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${DRIVER_STYLE[driver]}`}
    >
      {driver.replace(/_/g, " ")}
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
        <div className="border-rule flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="panel-title">{data.ticker} - Executive Summary</h2>
            {data.question && (
              <p className="text-muted-foreground mt-1 font-serif text-xs italic">
                "{data.question}"
              </p>
            )}
          </div>
          <DriverBadge driver={data.likelyDriver} />
        </div>

        {data.status === "FAILED" ? (
          <div className="space-y-4">
            <p className="text-destructive text-sm leading-relaxed">
              This investigation did not complete, so there is no explanation to show.
            </p>
            {onReinvestigate && (
              <Button type="button" onClick={onReinvestigate} className="w-fit">
                <RefreshCw aria-hidden />
                Run it again
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-signal-text font-mono text-xs font-bold tracking-wider uppercase">
                  What Changed?
                </h3>
                <p className="text-foreground/90 text-sm leading-relaxed">{data.whatChanged}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-ink/85 font-mono text-xs font-bold tracking-wider uppercase">
                  Why It Matters?
                </h3>
                <p className="text-foreground/90 text-sm leading-relaxed">{data.whyItMatters}</p>
              </div>
            </div>

            <div className="border-rule space-y-2 border-t pt-3">
              <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
                Detailed Explanation
              </h3>
              <p className="text-foreground/80 text-sm leading-relaxed">{data.explanation}</p>
            </div>
          </>
        )}
      </section>

      {data.evidenceCards.some((card) => card.finding !== null) && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold tracking-tight">Evidence Cards</h2>
          <EvidencePanel cards={data.evidenceCards} />
        </section>
      )}

      {data.timeline.length > 0 && (
        <section className="dashboard-panel space-y-4">
          <div>
            <h2 className="panel-title">Timeline</h2>
            <p className="panel-subtitle">
              Previous runs for this ticker, newest first, with what changed since the run before.
            </p>
          </div>
          <InvestigationTimeline entries={data.timeline} ticker={data.ticker} />
        </section>
      )}

      {data.investigationPath.length > 0 && (
        <section className="dashboard-panel space-y-4">
          <div>
            <h2 className="panel-title">Investigation Path</h2>
            <p className="panel-subtitle">
              The steps the agent took, in order, with what each one found.
            </p>
          </div>
          <InvestigationPath steps={data.investigationPath} />
        </section>
      )}

      {data.status === "COMPLETED" && (
        <>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="dashboard-panel space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="panel-title">Confidence</h3>
                <ConfidenceBadge level={data.confidence} />
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {data.confidenceReason}
              </p>
            </div>

            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">What to Monitor</h3>
              {data.whatToMonitor.length > 0 ? (
                <ul className="text-foreground/90 list-inside list-disc space-y-2 text-xs">
                  {data.whatToMonitor.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">No monitoring items were reported.</p>
              )}
            </div>

            <div className="dashboard-panel space-y-3">
              <h3 className="panel-title">Previous Comparison</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {data.previousComparison || "No previous investigation for this ticker."}
              </p>
            </div>
          </section>

          <footer className="border-rule border-t pt-4 text-center">
            <p className="text-muted-foreground font-mono text-xs italic">
              Disclaimer: This analysis is informational and does not constitute investment advice.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
