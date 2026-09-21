import { END, START, StateGraph } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";
import type { DeterministicSignals } from "../../analysis/signals.ts";
import type { ToolContext, ToolDefinition } from "../../tools/index.ts";
import { applyRoutingPolicy, routeInvestigation, type InvestigationRoute } from "./routing.ts";
import {
  BaselineContextSchema,
  EvidenceItemSchema,
  InvestigationPlanSchema,
  InvestigationResultSchema,
  ToolCallRecordSchema,
  type BaselineContext,
  type EvidenceItem,
  type InvestigationPlan,
  type InvestigationResult,
  type PreviousInvestigation,
  type ToolCallRecord,
} from "./schemas.ts";
import { StockInvestigatorState, type StockInvestigatorStateType } from "./state.ts";

export type BaselineCollection = {
  readonly baseline: BaselineContext;
  readonly evidence: readonly EvidenceItem[];
  readonly toolCalls: readonly ToolCallRecord[];
};

/**
 * Thrown when Sectors cannot supply the data an investigation is built on.
 *
 * PRD §25: when core stock/market data fails the investigation must fail with a
 * user-readable error instead of "completing" with empty signals.
 */
export class BaselineUnavailableError extends Error {
  readonly reason: "unknown_ticker" | "no_price_data" | "no_market_data";

  constructor(reason: BaselineUnavailableError["reason"], message: string) {
    super(message);
    this.name = "BaselineUnavailableError";
    this.reason = reason;
  }
}

/** Fails fast when the baseline cannot support deterministic signals. */
export function assertBaselineUsable(collection: BaselineCollection, ticker: string): void {
  const priceFailed = collection.toolCalls.find(
    (call) => call.toolName === "get_price_context" && call.status === "failed",
  );
  if (priceFailed) {
    throw new BaselineUnavailableError(
      "no_price_data",
      `Could not collect price data for ${ticker}: ${priceFailed.errorMessage ?? "Sectors API unavailable"}.`,
    );
  }

  const marketFailed = collection.toolCalls.find(
    (call) => call.toolName === "get_market_context" && call.status === "failed",
  );
  if (marketFailed) {
    throw new BaselineUnavailableError(
      "no_market_data",
      `Could not collect market benchmark data for ${ticker}: ${marketFailed.errorMessage ?? "Sectors API unavailable"}.`,
    );
  }

  if (collection.baseline.price.length < 2) {
    throw new BaselineUnavailableError(
      "no_price_data",
      `Sectors returned too little price history for ${ticker} to calculate a move.`,
    );
  }

  if (collection.baseline.market.length < 2) {
    throw new BaselineUnavailableError(
      "no_market_data",
      `Sectors returned too little IHSG history to compare ${ticker} against the market.`,
    );
  }
}

export type PlannerInput = {
  readonly ticker: string;
  readonly question?: string;
  readonly baseline: BaselineContext;
  readonly signals: DeterministicSignals;
  readonly previousInvestigation: PreviousInvestigation | null;
  readonly evidence: readonly EvidenceItem[];
  /** Branch selected by the deterministic signals before any model call. */
  readonly route: InvestigationRoute;
};

export type SynthesizerInput = PlannerInput & {
  readonly plan: InvestigationPlan;
};

export type StockInvestigatorDependencies = {
  readonly collectBaseline: (
    input: { readonly ticker: string; readonly question?: string },
    context: ToolContext,
  ) => Promise<BaselineCollection>;
  readonly calculateSignals: (input: BaselineContext) => DeterministicSignals;
  readonly planner: (input: PlannerInput) => Promise<InvestigationPlan>;
  readonly tools: readonly ToolDefinition[];
  readonly synthesizer: (input: SynthesizerInput) => Promise<InvestigationResult>;
};

export function buildStockInvestigatorGraph(dependencies: StockInvestigatorDependencies) {
  const collectBaseline = async (state: StockInvestigatorStateType) => {
    const collection = await dependencies.collectBaseline(
      { ticker: state.ticker, question: state.question },
      createToolContext(state),
    );
    assertBaselineUsable(collection, state.ticker);
    return {
      status: "collecting_baseline" as const,
      baseline: BaselineContextSchema.parse(collection.baseline),
      evidence: collection.evidence.map((item) => EvidenceItemSchema.parse(item)),
      toolCalls: collection.toolCalls.map((item) => ToolCallRecordSchema.parse(item)),
    };
  };

  const calculateSignals = async (state: StockInvestigatorStateType) => {
    if (!state.baseline) throw new Error("Baseline data is required before signal calculation");
    const signals = dependencies.calculateSignals(state.baseline);
    return {
      status: "calculating_signals" as const,
      signals,
      route: routeInvestigation(signals),
    };
  };

  const planInvestigation = async (state: StockInvestigatorStateType) => {
    if (!state.baseline || !state.signals || !state.route) {
      throw new Error("Baseline, deterministic signals, and a route are required before planning");
    }
    const plan = await dependencies.planner({
      ticker: state.ticker,
      question: state.question,
      baseline: state.baseline,
      signals: state.signals,
      previousInvestigation: state.previousInvestigation,
      evidence: state.evidence,
      route: state.route,
    });
    const parsedPlan = InvestigationPlanSchema.parse(plan);
    const { allowed, blocked } = applyRoutingPolicy(parsedPlan, state.route);
    return {
      status: "planning" as const,
      plan: InvestigationPlanSchema.parse({ hypotheses: parsedPlan.hypotheses, steps: allowed }),
      blockedSteps: blocked.map((step) => ({
        id: step.id,
        intent: step.intent,
        tool: step.tool,
        input: step.input,
      })),
    };
  };

  const investigateEvidence = async (state: StockInvestigatorStateType) => {
    if (!state.plan) throw new Error("Investigation plan is required before evidence collection");
    const toolsByName: Record<string, ToolDefinition> = Object.fromEntries(
      dependencies.tools.map((tool) => [tool.name, tool]),
    );
    const evidence: EvidenceItem[] = [];
    const toolCalls: ToolCallRecord[] = [];

    for (const step of state.blockedSteps ?? []) {
      toolCalls.push(
        createToolCall({
          step,
          status: "skipped",
          startedAt: new Date(),
          errorCode: "ROUTING_BLOCKED",
          errorMessage: `The ${state.route?.branch ?? "selected"} branch did not allow this tool for this move.`,
        }),
      );
    }

    for (const step of state.plan.steps) {
      const startedAt = new Date();
      const tool = toolsByName[step.tool];
      if (!tool) {
        toolCalls.push(
          createToolCall({
            step,
            status: "failed",
            startedAt,
            errorCode: "TOOL_NOT_ALLOWED",
            errorMessage: `Tool is not registered: ${step.tool}`,
          }),
        );
        continue;
      }

      const input = step.input ?? {};
      const parsedInput = tool.inputSchema.safeParse(input);
      if (!parsedInput.success) {
        toolCalls.push(
          createToolCall({
            step,
            status: "failed",
            startedAt,
            input,
            errorCode: "INVALID_TOOL_INPUT",
            errorMessage: parsedInput.error.issues.map((issue) => issue.message).join("; "),
          }),
        );
        continue;
      }

      try {
        const execution = await tool.execute(parsedInput.data, createToolContext(state));
        const executionEvidence = execution.evidence.map((item) => EvidenceItemSchema.parse(item));
        evidence.push(...executionEvidence);
        toolCalls.push(
          createToolCall({
            step,
            status: "succeeded",
            startedAt,
            input,
            output: execution.value,
          }),
        );
      } catch (error) {
        toolCalls.push(
          createToolCall({
            step,
            status: "failed",
            startedAt,
            input,
            errorCode: "TOOL_EXECUTION_FAILED",
            errorMessage: errorMessage(error),
          }),
        );
      }
    }

    return { status: "investigating" as const, evidence, toolCalls };
  };

  const synthesize = async (state: StockInvestigatorStateType) => {
    if (!state.baseline || !state.signals || !state.plan || !state.route) {
      throw new Error("Investigation context is incomplete before synthesis");
    }
    const result = await dependencies.synthesizer({
      ticker: state.ticker,
      question: state.question,
      baseline: state.baseline,
      signals: state.signals,
      previousInvestigation: state.previousInvestigation,
      evidence: state.evidence,
      plan: state.plan,
      route: state.route,
    });
    return {
      status: "synthesizing" as const,
      result: InvestigationResultSchema.parse(result),
    };
  };

  const finalize = async (state: StockInvestigatorStateType) => {
    if (!state.result) throw new Error("Synthesis did not produce an investigation result");
    return { status: "completed" as const };
  };

  return new StateGraph(StockInvestigatorState)
    .addNode("collectBaseline", collectBaseline)
    .addNode("calculateSignals", calculateSignals)
    .addNode("planInvestigation", planInvestigation)
    .addNode("investigateEvidence", investigateEvidence)
    .addNode("synthesize", synthesize)
    .addNode("finalize", finalize)
    .addEdge(START, "collectBaseline")
    .addEdge("collectBaseline", "calculateSignals")
    .addEdge("calculateSignals", "planInvestigation")
    .addEdge("planInvestigation", "investigateEvidence")
    .addEdge("investigateEvidence", "synthesize")
    .addEdge("synthesize", "finalize")
    .addEdge("finalize", END)
    .compile();
}

function createToolContext(state: StockInvestigatorStateType): ToolContext {
  return { ticker: state.ticker, investigationId: state.investigationId };
}

function createToolCall(input: {
  readonly step: { id: string; intent: string; tool: string };
  readonly status: ToolCallRecord["status"];
  readonly startedAt: Date;
  readonly input?: Record<string, unknown>;
  readonly output?: unknown;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}): ToolCallRecord {
  const finishedAt = new Date();
  return ToolCallRecordSchema.parse({
    id: randomUUID(),
    toolName: input.step.tool,
    status: input.status,
    reason: input.step.intent,
    input: input.input,
    output: input.output,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    durationMs: finishedAt.getTime() - input.startedAt.getTime(),
    startedAt: input.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
