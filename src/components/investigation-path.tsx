import type { InvestigationPathStep, PathStepStatus } from "@/lib/investigation-view-model";
import { Check, ChevronDown, LoaderCircle, MinusCircle, TriangleAlert } from "lucide-react";

const STATUS_STYLE: Record<
  PathStepStatus,
  { icon: typeof Check; iconClass: string; borderClass: string; label: string }
> = {
  success: {
    icon: Check,
    iconClass: "bg-signal text-signal-ink",
    borderClass: "border-ink/12",
    label: "Selesai",
  },
  failure: {
    icon: TriangleAlert,
    iconClass: "bg-destructive/20 text-destructive",
    borderClass: "border-destructive/40",
    label: "Gagal",
  },
  skipped: {
    icon: MinusCircle,
    iconClass: "bg-muted text-muted-foreground",
    borderClass: "border-border/40",
    label: "Dilewati",
  },
  running: {
    icon: LoaderCircle,
    iconClass: "bg-signal/25 text-signal-text",
    borderClass: "border-signal/45",
    label: "Berjalan",
  },
};

export function InvestigationPath({ steps }: { steps: readonly InvestigationPathStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-4">
      <ol>
        {steps.map((step, index) => (
          <PathStep
            key={`${step.toolName}-${index}`}
            step={step}
            isLast={index === steps.length - 1}
          />
        ))}
      </ol>

      <details className="group">
        <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase">
          <ChevronDown
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
          Detail teknis
        </summary>
        <ul className="text-muted-foreground mt-2 space-y-1 font-mono text-[11px]">
          {steps.map((step, index) => (
            <li key={`${step.toolName}-tech-${index}`}>
              {step.toolName} · {step.status} · {step.durationMs} ms
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function PathStep({ step, isLast }: { step: InvestigationPathStep; isLast: boolean }) {
  const style = STATUS_STYLE[step.status];
  const Icon = style.icon;
  const isRunning = step.status === "running";

  return (
    <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0">
      {!isLast && <span className="bg-rule absolute left-[11px] top-6 bottom-0 w-px" aria-hidden />}
      <span
        className={`relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${style.iconClass}`}
      >
        <Icon className={`size-3 ${isRunning ? "animate-spin" : ""}`} aria-hidden />
      </span>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-sm font-semibold">{step.label}</h3>
          <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
            {style.label}
          </span>
        </div>
        {step.reason && (
          <p className="text-muted-foreground text-xs leading-relaxed italic">{step.reason}</p>
        )}
        {step.findings.length > 0 ? (
          <ul className="space-y-1">
            {step.findings.map((finding, index) => (
              <li
                key={index}
                className="text-foreground/90 flex items-start gap-1.5 text-xs leading-relaxed"
              >
                <span
                  className="text-muted-foreground mt-1.5 size-1 shrink-0 rounded-full bg-current"
                  aria-hidden
                />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        ) : (
          step.status === "success" && (
            <p className="text-muted-foreground text-xs">Tidak ada temuan berarti yang tercatat.</p>
          )
        )}
      </div>
    </li>
  );
}
