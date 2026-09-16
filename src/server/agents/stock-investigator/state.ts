import { Annotation } from "@langchain/langgraph";
import type { InvestigationStatus } from "../../../shared/schemas/investigation.ts";
import type { DeterministicSignals } from "../../analysis/signals.ts";
import type {
  BaselineContext,
  EvidenceItem,
  InvestigationPlan,
  InvestigationResult,
  PreviousInvestigation,
  ToolCallRecord,
} from "./schemas.ts";

/**
 * Shared state for the stock investigation graph.
 *
 * Arrays accumulate across nodes; scalar values are replaced by the newest
 * node update so each stage remains inspectable in streamed state updates.
 */
export const StockInvestigatorState = Annotation.Root({
  investigationId: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  ticker: Annotation<string>,
  question: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  baseline: Annotation<BaselineContext | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  signals: Annotation<DeterministicSignals | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  plan: Annotation<InvestigationPlan | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  previousInvestigation: Annotation<PreviousInvestigation | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  evidence: Annotation<EvidenceItem[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  result: Annotation<InvestigationResult | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  status: Annotation<InvestigationStatus>({
    reducer: (_current, update) => update,
    default: () => "pending",
  }),
});

/** Full state as seen by nodes. */
export type StockInvestigatorStateType = typeof StockInvestigatorState.State;

/** Partial update a node may return. */
export type StockInvestigatorUpdate = typeof StockInvestigatorState.Update;
