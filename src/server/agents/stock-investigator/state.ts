import { Annotation } from "@langchain/langgraph";
import type { InvestigationStatus } from "../../../shared/schemas/investigation.ts";
import type { EvidenceItem } from "./schemas.ts";

/**
 * Shared state for the stock investigation graph.
 *
 * `evidence` accumulates across nodes via a reducer, `status` is last-write
 * wins, and `question` is optional so a plain ticker lookup stays possible.
 */
export const StockInvestigatorState = Annotation.Root({
  ticker: Annotation<string>,
  question: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  evidence: Annotation<EvidenceItem[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
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
