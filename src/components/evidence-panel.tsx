import type { EvidenceCard } from "@/lib/investigation-view-model";
import {
  Banknote,
  Check,
  Factory,
  FileText,
  Globe,
  Landmark,
  Newspaper,
  TrendingUp,
  X,
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

const IMPORTANCE_CLASS: Record<NonNullable<EvidenceCard["importance"]>, string> = {
  high: "border-signal/40 bg-signal/15 text-ink",
  medium: "border-ink/20 bg-ink/8 text-ink/85",
  low: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function EvidencePanel({ cards }: { cards: readonly EvidenceCard[] }) {
  if (!cards.some((card) => card.finding !== null)) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <EvidenceCardItem key={card.type} card={card} />
      ))}
    </div>
  );
}

function EvidenceCardItem({ card }: { card: EvidenceCard }) {
  const Icon = ICON_BY_TYPE[card.type];
  const collected = card.finding !== null;
  return (
    <div className="dashboard-panel flex flex-col gap-2 p-4">
      <div className="border-rule flex items-center gap-2 border-b pb-2">
        <Icon className="text-muted-foreground size-4" aria-hidden />
        <h3 className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
          {card.label}
        </h3>
        {card.importance && (
          <span
            className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase ${IMPORTANCE_CLASS[card.importance]}`}
          >
            {card.importance}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-xs leading-relaxed">
        {collected ? (
          <Check className="text-ink mt-0.5 size-3.5 shrink-0" aria-hidden />
        ) : (
          <X className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0" aria-hidden />
        )}
        <span>{card.finding ?? "No notable finding in this category."}</span>
      </p>
    </div>
  );
}
