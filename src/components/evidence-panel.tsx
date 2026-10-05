import type { EvidenceCard } from "@/lib/investigation-view-model";
import { IMPORTANCE_TEXT } from "@/shared/schemas/investigation.ts";
import {
  Banknote,
  Check,
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

const IMPORTANCE_CLASS: Record<NonNullable<EvidenceCard["importance"]>, string> = {
  high: "border-signal/40 bg-signal/15 text-ink",
  medium: "border-ink/20 bg-ink/8 text-ink/85",
  low: "border-border/60 bg-muted/40 text-muted-foreground",
};

/** One deliberate empty treatment; a category without a finding is a result, not an error. */
const NO_FINDING = "Tidak ada temuan berarti pada kategori ini.";

export function EvidencePanel({ cards }: { cards: readonly EvidenceCard[] }) {
  if (!cards.some((card) => card.finding !== null)) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:auto-rows-fr md:grid-cols-2">
      {cards.map((card) => (
        <EvidenceCardItem key={card.type} card={card} />
      ))}
    </div>
  );
}

function EvidenceCardItem({ card }: { card: EvidenceCard }) {
  const Icon = ICON_BY_TYPE[card.type];
  return (
    <div className="dashboard-panel flex h-full min-h-[9rem] flex-col gap-3 p-4">
      <div className="border-rule flex items-center gap-2 border-b pb-3">
        <Icon className="text-muted-foreground size-4" aria-hidden />
        <h3 className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
          {card.label}
        </h3>
        {card.importance && (
          <span
            className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase ${IMPORTANCE_CLASS[card.importance]}`}
          >
            {IMPORTANCE_TEXT[card.importance]}
          </span>
        )}
      </div>

      {card.finding !== null ? (
        <p className="text-foreground/90 flex flex-1 items-start gap-2 text-sm leading-relaxed">
          <Check className="text-ink mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{card.finding}</span>
        </p>
      ) : (
        <p className="text-muted-foreground/80 flex flex-1 items-center border-l-2 border-border/60 pl-3 text-sm leading-relaxed italic">
          {NO_FINDING}
        </p>
      )}
    </div>
  );
}
