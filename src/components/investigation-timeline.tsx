import type { TimelineEntry } from "@/lib/history-view-model";
import { CONFIDENCE_TEXT, DRIVER_TEXT } from "@/shared/schemas/investigation.ts";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

const STATUS_TEXT: Record<TimelineEntry["status"], string> = {
  COMPLETED: "Selesai",
  IN_PROGRESS: "Berjalan",
  FAILED: "Gagal",
};

/** Runs shown before the list collapses; a busy ticker can have dozens. */
const VISIBLE_RUNS = 5;

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
  const [showAll, setShowAll] = useState(false);
  if (entries.length === 0) return null;

  const visible = showAll ? entries : entries.slice(0, VISIBLE_RUNS);
  const hiddenCount = entries.length - visible.length;
  // Entries arrive newest-first, so the first one is always the latest run.
  const newestId = entries[0]?.id ?? null;

  return (
    <div className="space-y-3">
      <ol className="space-y-2.5">
        {visible.map((entry) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            ticker={ticker}
            isNewest={entry.id === newestId}
          />
        ))}
      </ol>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-full rounded-lg py-2 font-mono text-[11px] tracking-wider uppercase outline-none focus-visible:ring-3"
        >
          Tampilkan {hiddenCount} investigasi sebelumnya
        </button>
      )}
      {showAll && entries.length > VISIBLE_RUNS && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-full rounded-lg py-2 font-mono text-[11px] tracking-wider uppercase outline-none focus-visible:ring-3"
        >
          Tampilkan investigasi terbaru saja
        </button>
      )}
    </div>
  );
}

function TimelineRow({
  entry,
  ticker,
  isNewest,
}: {
  entry: TimelineEntry;
  ticker: string;
  isNewest: boolean;
}) {
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
            {DRIVER_TEXT[entry.driver]}
          </span>
        )}
        {entry.confidence && (
          <span className="text-muted-foreground text-[10px]">
            Keyakinan {CONFIDENCE_TEXT[entry.confidence].toLowerCase()}
          </span>
        )}
        {entry.isCurrent && <span className="badge badge-signal ml-auto">Saat ini</span>}
        {!entry.isCurrent && isNewest && <span className="badge badge-ink ml-auto">Terbaru</span>}
      </div>
      {entry.summary && (
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {entry.summary}
        </p>
      )}
      {entry.delta && (
        <p className="text-foreground/85 text-xs leading-relaxed">
          <span className="text-muted-foreground">Perubahan sejak investigasi sebelumnya: </span>
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
        aria-label={`Buka investigasi ${ticker} tanggal ${formatDate(entry.date)}`}
        className="focus-visible:ring-ring/50 block rounded-lg p-3 outline-none focus-visible:ring-3"
      >
        {body}
      </Link>
    </li>
  );
}
