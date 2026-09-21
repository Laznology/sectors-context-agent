import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { calculateSignals } from "../../analysis/signals.ts";
import { type ToolDefinition } from "../../tools/index.ts";
import {
  BaselineUnavailableError,
  type StockInvestigatorDependencies,
  assertBaselineUsable,
  buildStockInvestigatorGraph,
} from "./graph.ts";
import { applyRoutingPolicy, routeInvestigation } from "./routing.ts";

const result = {
  driver: "FLOW_DRIVEN" as const,
  classification: "bullish" as const,
  status: "attention" as const,
  confidence: 0.8,
  confidenceReason: "Multiple independent sources agree.",
  whatChanged: "Price rose with unusual volume.",
  whyItMatters: "The move is stronger than the market.",
  explanation: "Foreign participation is the most consistent signal.",
  whatToMonitor: ["Foreign flow direction", "Volume versus the 20-day average"],
  evidenceSummary: [{ label: "Foreign flow", finding: "Net inflow", importance: "high" as const }],
  changesSincePrevious: null,
  disclaimer: "This analysis is informational and does not constitute investment advice.",
};

function toolThatRecords(name: string, calledTools: string[]): ToolDefinition {
  return {
    name,
    description: `${name} for one ticker`,
    inputSchema: z.object({}),
    execute: async () => {
      calledTools.push(name);
      return { value: {}, evidence: [] };
    },
  };
}

const baseline = {
  price: [
    { date: "2026-09-15", close: 100, volume: 100 },
    { date: "2026-09-16", close: 110, volume: 180 },
  ],
  market: [
    { date: "2026-09-15", close: 100 },
    { date: "2026-09-16", close: 105 },
  ],
};

describe("stock investigator graph", () => {
  it("runs explicit stages and only executes tools the route allows", async () => {
    const calledTools: string[] = [];
    const dependencies: StockInvestigatorDependencies = {
      collectBaseline: async () => ({
        baseline,
        evidence: [
          {
            id: "price-1",
            type: "price_volume",
            source: "sectors:daily",
            summary: "Price and volume collected.",
          },
        ],
        toolCalls: [],
      }),
      calculateSignals,
      planner: async () => ({
        hypotheses: ["FLOW_DRIVEN"],
        steps: [
          { id: "step-flow", intent: "Check foreign participation", tool: "get_foreign_flow" },
          { id: "step-broker", intent: "Check broker activity", tool: "get_broker_activity" },
        ],
      }),
      tools: [
        toolThatRecords("get_foreign_flow", calledTools),
        toolThatRecords("get_broker_activity", calledTools),
      ],
      synthesizer: async () => result,
    };

    const graph = buildStockInvestigatorGraph(dependencies);
    const output = await graph.invoke({ ticker: "ANTM", question: "Why did ANTM move?" });

    expect(output.status).toBe("completed");
    expect(output.signals?.relativeReturn).toBeCloseTo(0.05);
    // The unusual move selects the full branch, so both planned tools are allowed.
    expect(output.route?.branch).toBe("full");
    expect(calledTools).toEqual(["get_foreign_flow", "get_broker_activity"]);
    expect(output.toolCalls.map((call) => [call.toolName, call.status])).toEqual([
      ["get_foreign_flow", "succeeded"],
      ["get_broker_activity", "succeeded"],
    ]);
    expect(output.result?.driver).toBe("FLOW_DRIVEN");
    expect(output.result?.disclaimer).toContain("not constitute investment advice");
  });

  it("blocks deep-dive tools when the move is unremarkable", async () => {
    const calledTools: string[] = [];
    const dependencies: StockInvestigatorDependencies = {
      collectBaseline: async () => ({ baseline, evidence: [], toolCalls: [] }),
      // A flat move: no unusual return and no unusual volume.
      calculateSignals: () =>
        calculateSignals(
          { price: baseline.price, market: baseline.market },
          {
            unusualReturn: 10,
            unusualVolumeRatio: 10,
            volumeWindow: 20,
          },
        ),
      planner: async () => ({
        hypotheses: ["FLOW_DRIVEN"],
        steps: [
          { id: "step-flow", intent: "Check foreign participation", tool: "get_foreign_flow" },
          { id: "step-sector", intent: "Sanity-check the sector", tool: "get_sector_context" },
        ],
      }),
      tools: [
        toolThatRecords("get_foreign_flow", calledTools),
        toolThatRecords("get_sector_context", calledTools),
      ],
      synthesizer: async () => result,
    };

    const graph = buildStockInvestigatorGraph(dependencies);
    const output = await graph.invoke({ ticker: "ANTM" });

    expect(output.route?.branch).toBe("limited");
    // Only the sector sanity check survives; the flow deep dive is recorded as skipped.
    expect(calledTools).toEqual(["get_sector_context"]);
    expect(output.toolCalls.map((call) => [call.toolName, call.status])).toEqual([
      ["get_foreign_flow", "skipped"],
      ["get_sector_context", "succeeded"],
    ]);
  });

  it("records an unregistered planned tool as a failed call", async () => {
    const dependencies: StockInvestigatorDependencies = {
      collectBaseline: async () => ({ baseline, evidence: [], toolCalls: [] }),
      calculateSignals,
      planner: async () => ({
        hypotheses: ["FLOW_DRIVEN"],
        steps: [
          { id: "step-unknown", intent: "Attempt an unapproved call", tool: "get_sector_context" },
        ],
      }),
      tools: [],
      synthesizer: async () => result,
    };

    const graph = buildStockInvestigatorGraph(dependencies);
    const output = await graph.invoke({ ticker: "ANTM" });

    expect(output.toolCalls.map((call) => [call.toolName, call.status, call.errorCode])).toEqual([
      ["get_sector_context", "failed", "TOOL_NOT_ALLOWED"],
    ]);
  });
});

describe("baseline gate", () => {
  it("fails when the price tool failed instead of completing with empty signals", () => {
    expect(() =>
      assertBaselineUsable(
        {
          baseline: { price: [], market: [] },
          evidence: [],
          toolCalls: [
            {
              id: "call-1",
              toolName: "get_price_context",
              status: "failed",
              errorMessage: "Sectors API request failed",
            },
          ],
        },
        "ANTM",
      ),
    ).toThrow(BaselineUnavailableError);
  });

  it("fails when Sectors returns too little history for a return", () => {
    expect(() =>
      assertBaselineUsable(
        {
          baseline: {
            price: [{ date: "2026-09-16", close: 110, volume: 180 }],
            market: baseline.market,
          },
          evidence: [],
          toolCalls: [],
        },
        "ANTM",
      ),
    ).toThrow(/too little price history/);
  });

  it("passes when both core sources returned enough history", () => {
    expect(() =>
      assertBaselineUsable({ baseline, evidence: [], toolCalls: [] }, "ANTM"),
    ).not.toThrow();
  });
});

describe("routing policy", () => {
  it("offers the full evidence chain for an unusual move", () => {
    const route = routeInvestigation({
      latestPrice: 110,
      latestVolume: 180,
      dailyReturn: 0.1,
      marketReturn: 0.05,
      relativeReturn: 0.05,
      averageVolume: 100,
      volumeRatio: 1.8,
      unusualMovement: true,
    });

    expect(route.branch).toBe("full");
    expect(route.allowedTools).toContain("get_broker_activity");
  });

  it("keeps only the sector check for an unremarkable move", () => {
    const route = routeInvestigation({
      latestPrice: 100,
      latestVolume: 100,
      dailyReturn: 0,
      marketReturn: 0,
      relativeReturn: 0,
      averageVolume: 100,
      volumeRatio: 1,
      unusualMovement: false,
    });

    expect(route.branch).toBe("limited");
    expect(route.allowedTools).toEqual(["get_sector_context"]);
  });

  it("splits a plan into allowed and blocked steps", () => {
    const route = routeInvestigation({
      latestPrice: 100,
      latestVolume: 100,
      dailyReturn: 0,
      marketReturn: 0,
      relativeReturn: 0,
      averageVolume: 100,
      volumeRatio: 1,
      unusualMovement: false,
    });

    const { allowed, blocked } = applyRoutingPolicy(
      {
        hypotheses: ["SECTOR_DRIVEN"],
        steps: [
          { id: "a", intent: "Sector", tool: "get_sector_context" },
          { id: "b", intent: "Flow", tool: "get_foreign_flow" },
        ],
      },
      route,
    );

    expect(allowed.map((step) => step.id)).toEqual(["a"]);
    expect(blocked.map((step) => step.id)).toEqual(["b"]);
  });
});
