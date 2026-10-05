import { CONFIDENCE_TEXT, DRIVER_TEXT } from "@/shared/schemas/investigation.ts";
import type { UiBlock } from "@/lib/conversation-view-model";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

const DIRECTION_ICON = { up: ArrowUp, down: ArrowDown, flat: ArrowRight } as const;

export function UiBlockView({ block }: { block: UiBlock }) {
  switch (block.type) {
    case "metric":
      return <MetricBlock block={block} />;
    case "comparison":
      return <ComparisonBlock block={block} />;
    case "series":
      return <SeriesBlock block={block} />;
    case "driver":
      return <DriverBlock block={block} />;
    case "sources":
      return <SourcesBlock block={block} />;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="border-rule bg-ink/4 rounded-lg border p-3">{children}</div>;
}

function MetricBlock({ block }: { block: Extract<UiBlock, { type: "metric" }> }) {
  const Icon = block.direction ? DIRECTION_ICON[block.direction] : null;
  return (
    <Frame>
      <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
        {block.label}
      </p>
      <p className="text-foreground tabular mt-1 flex items-center gap-1.5 text-lg font-semibold">
        {block.value}
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {block.change && <span className="text-xs font-normal opacity-80">{block.change}</span>}
      </p>
    </Frame>
  );
}

function ComparisonBlock({ block }: { block: Extract<UiBlock, { type: "comparison" }> }) {
  return (
    <Frame>
      <p className="text-muted-foreground mb-2 font-mono text-[10px] tracking-wider uppercase">
        {block.title}
      </p>
      <table className="w-full text-xs">
        <tbody className="divide-border/40 divide-y">
          {block.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="text-muted-foreground py-1.5 text-left font-normal">
                {row.label}
              </th>
              <td className="tabular text-foreground py-1.5 text-right font-medium">{row.value}</td>
              {row.note && (
                <td className="text-muted-foreground py-1.5 pl-3 text-right text-[11px]">
                  {row.note}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

function SeriesBlock({ block }: { block: Extract<UiBlock, { type: "series" }> }) {
  const values = block.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 240;
  const height = 40;
  const path = block.points
    .map((point, index) => {
      const x = (index / Math.max(block.points.length - 1, 1)) * width;
      const y = height - ((point.value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <Frame>
      <p className="text-muted-foreground mb-2 font-mono text-[10px] tracking-wider uppercase">
        {block.title}
        {block.unit ? ` (${block.unit})` : ""}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-10 w-full"
        role="img"
        aria-label={`${block.title}: ${values.length} titik dari ${values[0]} sampai ${values[values.length - 1]}`}
        preserveAspectRatio="none"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-signal"
        />
      </svg>
      <p className="text-muted-foreground tabular mt-1 text-[11px]">
        {block.points[0].date} sampai {block.points[block.points.length - 1].date}
      </p>
    </Frame>
  );
}

function DriverBlock({ block }: { block: Extract<UiBlock, { type: "driver" }> }) {
  return (
    <Frame>
      <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
        Driver yang paling mungkin
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <span className="badge badge-signal">{DRIVER_TEXT[block.driver]}</span>
        <span className="badge badge-ink">keyakinan {CONFIDENCE_TEXT[block.confidence]}</span>
      </p>
    </Frame>
  );
}

function SourcesBlock({ block }: { block: Extract<UiBlock, { type: "sources" }> }) {
  return (
    <Frame>
      <p className="text-muted-foreground mb-1 font-mono text-[10px] tracking-wider uppercase">
        Sumber
      </p>
      <ul className="space-y-1 text-xs">
        {block.items.map((item) => (
          <li key={item.label} className="text-foreground/90">
            {item.label}
            {item.detail && <span className="text-muted-foreground"> - {item.detail}</span>}
          </li>
        ))}
      </ul>
    </Frame>
  );
}
