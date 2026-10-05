import type { EvidenceCard } from "@/lib/investigation-view-model";
import {
  Banknote,
  ChevronDown,
  Factory,
  FileText,
  Globe,
  Landmark,
  Newspaper,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const ICON_BY_TYPE: Record<EvidenceCard["type"], LucideIcon> = {
  price_volume: TrendingUp,
  market: Globe,
  sector: Factory,
  foreign_flow: Banknote,
  broker: Landmark,
  news: Newspaper,
  filing: FileText,
};

const IMPORTANCE_LABEL: Record<NonNullable<EvidenceCard["importance"]>, string> = {
  high: "Utama",
  medium: "Pendukung",
  low: "Konteks",
};

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function EvidencePanel({ cards }: { cards: readonly EvidenceCard[] }) {
  const findings = cards
    .filter((card) => card.finding !== null)
    .sort(
      (left, right) =>
        (IMPORTANCE_ORDER[left.importance ?? "low"] ?? 3) -
        (IMPORTANCE_ORDER[right.importance ?? "low"] ?? 3),
    );
  const unchecked = cards.filter((card) => card.finding === null);

  if (findings.length === 0) return null;

  return (
    <div>
      <ol className="divide-y divide-border/50">
        {findings.map((card) => {
          const Icon = ICON_BY_TYPE[card.type];
          return (
            <li
              key={card.type}
              className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.7fr)]"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-foreground text-sm font-medium">{card.label}</h3>
                  {card.importance && (
                    <p
                      className={`mt-1 font-mono text-[10px] tracking-wide uppercase ${card.importance === "high" ? "text-signal-text" : "text-muted-foreground"}`}
                    >
                      {IMPORTANCE_LABEL[card.importance]}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-foreground/90 text-sm leading-relaxed">{card.finding}</p>
            </li>
          );
        })}
      </ol>

      {unchecked.length > 0 && (
        <details className="group border-t border-border/50 pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
            <span>{unchecked.length} kategori tanpa temuan berarti</span>
          </summary>
          <ul className="mt-3 grid gap-2 pl-6 text-sm text-muted-foreground sm:grid-cols-2">
            {unchecked.map((card) => (
              <li key={card.type}>{card.label}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
