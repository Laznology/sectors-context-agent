import type { TimelineEntry } from "@/lib/history-view-model";
import { Link } from "@tanstack/react-router";

const STATUS_TEXT: Record<TimelineEntry["status"], string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  FAILED: "Failed",
};

const CONFIDENCE_TEXT = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function InvestigationTimeline({
  entries,
  ticker,
}: {
  entries: readonly TimelineEntry[];
  ticker: string;
}) {
  if (entries.length === 0) return null;

  return (
    <ol className="space-y-2.5">
      {entries.map((entry) => (
        <TimelineRow key={entry.id} entry={entry} ticker={ticker} />
      ))}
    </ol>
  );
}

function TimelineRow({ entry, ticker }: { entry: TimelineEntry; ticker: string }) {
  const body = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <time dateTime={entry.date} className="text-foreground text-xs font-medium">
          {formatDate(entry.date)}
        </time>
        <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
          {STATUS_TEXT[entry.status]}
        </span>
        {entry.driver && (
          <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
            {entry.driver.replace(/_/g, " ")}
          </span>
        )}
        {entry.confidence && (
          <span className="text-muted-foreground text-[10px]">
            {CONFIDENCE_TEXT[entry.confidence]} confidence
          </span>
        )}
        {entry.isCurrent && <span className="badge badge-signal ml-auto">Current</span>}
      </div>
      {entry.summary && (
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {entry.summary}
        </p>
      )}
      {entry.delta && (
        <p className="text-foreground/85 text-xs leading-relaxed">
          <span className="text-muted-foreground">Change since previous: </span>
          {entry.delta}
        </p>
      )}
    </div>
  );

  if (entry.isCurrent) {
    return <li className="border-signal/45 bg-signal/10 rounded-lg border p-3">{body}</li>;
  }

  return (
    <li className="border-rule bg-ink/4 rounded-lg border transition-colors hover:border-signal/40">
      <Link
        to="/investigations/$ticker"
        params={{ ticker: entry.id }}
        aria-label={`Open the ${ticker} investigation from ${formatDate(entry.date)}`}
        className="focus-visible:ring-ring/50 block rounded-lg p-3 outline-none focus-visible:ring-3"
      >
        {body}
      </Link>
    </li>
  );
}
