import type { InvestigationStatus } from "../../../shared/schemas/investigation.ts";
import type { DeterministicSignals } from "../../analysis/signals.ts";
import type { InvestigationStore } from "../../db/investigations.ts";
import { buildStockInvestigatorGraph, type StockInvestigatorDependencies } from "./graph.ts";
import { logInvestigation } from "./logging.ts";
import type { InvestigationRoute } from "./routing.ts";
import type {
  BaselineContext,
  EvidenceItem,
  InvestigationPlan,
  InvestigationPlanStep,
  InvestigationResult,
  PreviousInvestigation,
  ToolCallRecord,
} from "./schemas.ts";
import type { StockInvestigatorStateType } from "./state.ts";

type StreamUpdate = {
  readonly status?: InvestigationStatus;
  readonly baseline?: BaselineContext;
  readonly signals?: DeterministicSignals;
  readonly route?: InvestigationRoute;
  readonly blockedSteps?: readonly InvestigationPlanStep[];
  readonly plan?: InvestigationPlan;
  readonly previousInvestigation?: PreviousInvestigation | null;
  readonly evidence?: readonly EvidenceItem[];
  readonly toolCalls?: readonly ToolCallRecord[];
  readonly result?: InvestigationResult;
};

export type InvestigationRunInput = {
  readonly investigationId: string;
  readonly userId: string;
  readonly ticker: string;
  readonly question?: string;
  readonly previousInvestigation: PreviousInvestigation | null;
};

export type InvestigationEvent =
  | {
      readonly id?: string;
      readonly type: "started";
      readonly investigationId: string;
      readonly ticker: string;
    }
  | {
      readonly id?: string;
      readonly type: "step";
      readonly step: string;
      readonly status: InvestigationStatus;
      /** Human-readable progress line, ready for the UI to render as-is. */
      readonly label: string;
    }
  | {
      readonly id?: string;
      readonly type: "plan";
      /** Drivers the planner is testing, in the PRD §15 vocabulary. */
      readonly hypotheses: readonly string[];
      readonly steps: readonly {
        readonly tool: string;
        readonly intent: string;
        readonly input?: Record<string, unknown>;
      }[];
      /** Why the deterministic signals allowed this depth. */
      readonly branch: string;
      readonly rationale: string;
    }
  | {
      readonly id?: string;
      readonly type: "evidence";
      /** Compact evidence for a card; the raw payload stays server-side. */
      readonly item: {
        readonly id: string;
        readonly type: string;
        readonly source: string;
        readonly summary: string;
      };
    }
  | { readonly id?: string; readonly type: "tool"; readonly toolCall: ToolCallRecord }
  | { readonly id?: string; readonly type: "completed"; readonly result: unknown }
  | { readonly id?: string; readonly type: "error"; readonly message: string };

export type InvestigationEventEmitter = (event: InvestigationEvent) => void;

export async function runStockInvestigation(
  input: InvestigationRunInput,
  dependencies: StockInvestigatorDependencies,
  store: InvestigationStore,
  emit: InvestigationEventEmitter,
): Promise<void> {
  const startedAt = Date.now();
  emit({ type: "started", investigationId: input.investigationId, ticker: input.ticker });
  logInvestigation({
    type: "started",
    investigationId: input.investigationId,
    ticker: input.ticker,
  });
  const graph = buildStockInvestigatorGraph(dependencies);
  let state = initialState(input);

  try {
    for await (const chunk of await graph.stream(state, { streamMode: "updates" })) {
      for (const [node, rawUpdate] of Object.entries(chunk as Record<string, StreamUpdate>)) {
        const update = rawUpdate;
        state = mergeState(state, update);
        await store.updateFromState(input.investigationId, {
          status: update.status,
          signalsJson: update.signals,
          planJson: update.plan,
          companyName: update.baseline?.company?.companyName ?? undefined,
          subSector: update.baseline?.company?.subSector ?? undefined,
          asOfDate: latestBaselineDate(update.baseline),
        });
        await persistNewEvidence(input.investigationId, update.evidence, store, emit);
        await persistNewToolCalls(input.investigationId, update.toolCalls, store, emit);

        if (update.plan && state.route) {
          emit({
            type: "plan",
            hypotheses: update.plan.hypotheses,
            steps: update.plan.steps.map((step) => ({
              tool: step.tool,
              intent: step.intent,
              input: step.input,
            })),
            branch: state.route.branch,
            rationale: state.route.rationale,
          });
        }

        if (update.status) {
          emit({ type: "step", step: node, status: update.status, label: stepLabel(node) });
          logInvestigation({
            type: "step",
            investigationId: input.investigationId,
            step: node,
            status: update.status,
          });
        }
      }
    }

    if (!state.result) throw new Error("Investigation graph completed without a result");
    await store.complete(input.investigationId, {
      result: state.result,
      signals: state.signals,
      plan: state.plan,
      evidenceSummary: state.evidence.map((item) => item.summary).join(" "),
      comparison: state.previousInvestigation,
      asOfDate: latestBaselineDate(state.baseline),
    });
    emit({ type: "completed", result: state.result });
    logInvestigation({
      type: "completed",
      investigationId: input.investigationId,
      driver: state.result.driver,
      statusLabel: state.result.status,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.fail(input.investigationId, message);
    emit({ type: "error", message });
    logInvestigation({
      type: "failed",
      investigationId: input.investigationId,
      message,
      durationMs: Date.now() - startedAt,
    });
  }
}

function initialState(input: InvestigationRunInput): StockInvestigatorStateType {
  return {
    investigationId: input.investigationId,
    ticker: input.ticker,
    question: input.question,
    baseline: undefined,
    signals: undefined,
    route: undefined,
    blockedSteps: [],
    plan: undefined,
    previousInvestigation: input.previousInvestigation,
    evidence: [],
    toolCalls: [],
    result: undefined,
    status: "pending",
  };
}

function mergeState(
  current: StockInvestigatorStateType,
  update: StreamUpdate,
): StockInvestigatorStateType {
  return {
    ...current,
    ...update,
    blockedSteps: update.blockedSteps ? [...update.blockedSteps] : current.blockedSteps,
    evidence: current.evidence.concat(update.evidence ?? []),
    toolCalls: current.toolCalls.concat(update.toolCalls ?? []),
  };
}

async function persistNewEvidence(
  investigationId: string,
  items: readonly EvidenceItem[] | undefined,
  store: InvestigationStore,
  emit: InvestigationEventEmitter,
): Promise<void> {
  if (!items || items.length === 0) return;
  await store.appendEvidence(investigationId, items);
  for (const item of items) {
    emit({
      type: "evidence",
      item: {
        id: item.id,
        type: item.type,
        source: item.source,
        summary: item.summary,
      },
    });
  }
}

const STEP_LABELS: Record<string, string> = {
  collectBaseline: "Collecting price, market, and company context",
  calculateSignals: "Calculating returns and volume signals",
  planInvestigation: "Planning which evidence to check",
  investigateEvidence: "Checking sector, flow, broker, and news",
  synthesize: "Synthesizing the evidence-backed explanation",
  finalize: "Finalizing the investigation",
};

function stepLabel(node: string): string {
  return STEP_LABELS[node] ?? node;
}

async function persistNewToolCalls(
  investigationId: string,
  records: readonly ToolCallRecord[] | undefined,
  store: InvestigationStore,
  emit: InvestigationEventEmitter,
): Promise<void> {
  if (!records || records.length === 0) return;
  await store.appendToolCalls(investigationId, records);
  for (const toolCall of records) {
    emit({ type: "tool", toolCall });
    logInvestigation({
      type: "tool",
      investigationId,
      toolName: toolCall.toolName,
      status: toolCall.status,
      durationMs: toolCall.durationMs,
      errorCode: toolCall.errorCode,
    });
  }
}

function latestBaselineDate(baseline: StockInvestigatorStateType["baseline"]): string | undefined {
  if (!baseline) return undefined;
  const dates = [...baseline.price, ...baseline.market].map((point) => point.date);
  return dates.sort().at(-1);
}
