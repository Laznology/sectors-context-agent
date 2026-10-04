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
    label: "Completed",
  },
  failure: {
    icon: TriangleAlert,
    iconClass: "bg-destructive/20 text-destructive",
    borderClass: "border-destructive/40",
    label: "Failed",
  },
  skipped: {
    icon: MinusCircle,
    iconClass: "bg-muted text-muted-foreground",
    borderClass: "border-border/40",
    label: "Skipped",
  },
  running: {
    icon: LoaderCircle,
    iconClass: "bg-signal/25 text-signal-text",
    borderClass: "border-signal/45",
    label: "Running",
  },
};

export function InvestigationPath({ steps }: { steps: readonly InvestigationPathStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-4">
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <PathStep key={`${step.toolName}-${index}`} step={step} />
        ))}
      </ol>

      <details className="group">
        <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase">
          <ChevronDown
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
          Technical details
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

function PathStep({ step }: { step: InvestigationPathStep }) {
  const style = STATUS_STYLE[step.status];
  const Icon = style.icon;
  const isRunning = step.status === "running";

  return (
    <li className={`bg-ink/4 rounded-lg border p-3 ${style.borderClass}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${style.iconClass}`}
        >
          <Icon className={`size-3 ${isRunning ? "animate-spin" : ""}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
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
                  <span className="text-muted-foreground mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          ) : (
            step.status === "success" && (
              <p className="text-muted-foreground text-xs">No notable finding recorded.</p>
            )
          )}
        </div>
      </div>
    </li>
  );
}
