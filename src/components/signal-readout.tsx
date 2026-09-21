import type { ReactNode } from "react";

/**
 * The product's signature motif: a calm editorial statement paired with a
 * compact "signal readout" panel. It reads like an instrument display —
 * monospace labels, tabular values, hairline meters — instead of marketing
 * copy. This is what makes the surface feel like a measuring tool.
 */
export function SignalReadout({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <section className="flex flex-col gap-8">
      <p className="text-signal-text tabular text-[11px] tracking-[0.22em] uppercase">{eyebrow}</p>

      <div className="flex flex-col gap-5">
        <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{description}</p>
      </div>

      <ReadoutPanel />
    </section>
  );
}

const READINGS: readonly { label: string; value: string; level: number }[] = [
  { label: "relative_return", value: "+4.10%", level: 0.82 },
  { label: "volume_ratio", value: "1.80×", level: 0.64 },
  { label: "foreign_flow", value: "inflow", level: 0.71 },
  { label: "confidence", value: "medium", level: 0.5 },
];

function ReadoutPanel() {
  return (
    <div className="border-rule bg-panel/60 w-full max-w-md rounded-md border p-5">
      <div className="border-rule mb-4 flex items-center justify-between border-b pb-3">
        <span className="text-muted-foreground tabular text-[11px] tracking-[0.2em] uppercase">
          sample readout · ANTM
        </span>
        <span className="bg-signal-soft text-signal-ink tabular rounded-sm px-2 py-0.5 text-[11px]">
          attention
        </span>
      </div>

      <dl className="flex flex-col gap-3">
        {READINGS.map((reading) => (
          <div key={reading.label} className="flex items-center gap-3">
            <dt className="text-muted-foreground tabular w-36 shrink-0 text-xs">{reading.label}</dt>
            <dd className="flex flex-1 items-center gap-3">
              <span className="bg-muted relative h-1 w-full max-w-24 overflow-hidden rounded-full">
                <span
                  className="bg-signal absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${reading.level * 100}%` }}
                />
              </span>
              <span className="tabular w-16 text-right text-xs">{reading.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
