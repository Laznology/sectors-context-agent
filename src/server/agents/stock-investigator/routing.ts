import type { DeterministicSignals } from "../../analysis/signals.ts";
import type { InvestigationPlan, InvestigationPlanStep } from "./schemas.ts";

/**
 * PRD §13 conditional routing.
 *
 * The deterministic signals pick a branch before any model call, so the default
 * investigation depth never depends on the planner's mood:
 *
 * - `limited`: the move is unremarkable, so only sector context may be added.
 * - `full`: the move is unusual, so the whole evidence chain is available.
 *
 * The planner still chooses *which* tools to call inside the branch; it cannot
 * widen the branch. See `applyRoutingPolicy`.
 */
export type InvestigationBranch = "limited" | "full";

export type InvestigationRoute = {
  readonly branch: InvestigationBranch;
  /** Tools the planner may select on this branch. */
  readonly allowedTools: readonly string[];
  /** Deterministic explanation shown in the investigation path. */
  readonly rationale: string;
};

const BASELINE_TOOLS = ["get_price_context", "get_market_context", "get_company_context"] as const;

/** Tools that are only justified when the move is actually unusual. */
const DEEP_DIVE_TOOLS = [
  "get_sector_context",
  "get_foreign_flow",
  "get_broker_activity",
  "get_company_news",
  "get_company_filings",
] as const;

export function routeInvestigation(signals: DeterministicSignals): InvestigationRoute {
  if (signals.unusualMovement) {
    return {
      branch: "full",
      allowedTools: [...BASELINE_TOOLS, ...DEEP_DIVE_TOOLS],
      rationale:
        "The move is unusual against the benchmark or its own volume baseline, so the full evidence chain is available.",
    };
  }

  return {
    branch: "limited",
    allowedTools: ["get_sector_context"],
    rationale:
      "The move is within normal range, so the investigation stays limited to a sector sanity check.",
  };
}

/**
 * Drops plan steps the branch does not allow.
 *
 * Returns the kept steps plus the dropped ones so the caller can record an
 * auditable tool call instead of silently ignoring them (PRD §25).
 */
export function applyRoutingPolicy(
  plan: InvestigationPlan,
  route: InvestigationRoute,
): { readonly allowed: InvestigationPlanStep[]; readonly blocked: InvestigationPlanStep[] } {
  const allowed: InvestigationPlanStep[] = [];
  const blocked: InvestigationPlanStep[] = [];

  for (const step of plan.steps) {
    if (route.allowedTools.includes(step.tool)) allowed.push(step);
    else blocked.push(step);
  }

  return { allowed, blocked };
}
