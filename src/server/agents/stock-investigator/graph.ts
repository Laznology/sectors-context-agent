import { END, START, StateGraph } from "@langchain/langgraph";
import { StockInvestigatorState } from "./state.ts";

/**
 * Placeholder nodes.
 *
 * The graph shape is final: START -> collectBaseline -> calculateSignals ->
 * planInvestigation -> investigateEvidence -> synthesize -> END. The next task
 * replaces these bodies with Sectors-backed tools and AI Gateway model calls;
 * nothing here performs network or LLM calls yet.
 */
const collectBaseline: typeof StockInvestigatorState.Node = async () => ({
  status: "collecting_baseline",
});

const calculateSignals: typeof StockInvestigatorState.Node = async () => ({
  status: "calculating_signals",
});

const planInvestigation: typeof StockInvestigatorState.Node = async () => ({
  status: "planning",
});

const investigateEvidence: typeof StockInvestigatorState.Node = async () => ({
  status: "investigating",
});

const synthesize: typeof StockInvestigatorState.Node = async () => ({
  status: "completed",
});

/**
 * Builds the stock investigation graph.
 *
 * Explicit nodes and controlled semantic tools only: no generic ReAct loop and
 * no model-driven HTTP requests. Persistence stays opt-in: pass a checkpointer
 * created by `src/server/agents/checkpointer.ts` to `compile()` when a caller
 * needs resumable runs.
 */
export function buildStockInvestigatorGraph() {
  return new StateGraph(StockInvestigatorState)
    .addNode("collectBaseline", collectBaseline)
    .addNode("calculateSignals", calculateSignals)
    .addNode("planInvestigation", planInvestigation)
    .addNode("investigateEvidence", investigateEvidence)
    .addNode("synthesize", synthesize)
    .addEdge(START, "collectBaseline")
    .addEdge("collectBaseline", "calculateSignals")
    .addEdge("calculateSignals", "planInvestigation")
    .addEdge("planInvestigation", "investigateEvidence")
    .addEdge("investigateEvidence", "synthesize")
    .addEdge("synthesize", END)
    .compile();
}
