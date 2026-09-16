import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { calculateSignals } from "../../analysis/signals.ts";
import { type ToolDefinition } from "../../tools/index.ts";
import { type StockInvestigatorDependencies, buildStockInvestigatorGraph } from "./graph.ts";

describe("stock investigator graph", () => {
  it("runs explicit stages and only executes tools selected by the plan", async () => {
    const calledTools: string[] = [];
    const foreignFlowTool: ToolDefinition = {
      name: "get_foreign_flow",
      description: "Foreign flow for one ticker",
      inputSchema: z.object({}),
      execute: async () => {
        calledTools.push("get_foreign_flow");
        return {
          value: { netForeignInflow: 100 },
          evidence: [
            {
              id: "flow-1",
              type: "foreign_flow",
              source: "sectors:foreign-flow",
              summary: "Foreign inflow strengthened.",
            },
          ],
        };
      },
    };
    const brokerTool: ToolDefinition = {
      name: "get_broker_activity",
      description: "Broker activity for one ticker",
      inputSchema: z.object({}),
      execute: async () => {
        calledTools.push("get_broker_activity");
        return { value: {}, evidence: [] };
      },
    };
    const dependencies: StockInvestigatorDependencies = {
      collectBaseline: async () => ({
        baseline: {
          price: [
            { date: "2026-09-15", close: 100, volume: 100 },
            { date: "2026-09-16", close: 110, volume: 180 },
          ],
          market: [
            { date: "2026-09-15", close: 100 },
            { date: "2026-09-16", close: 105 },
          ],
        },
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
        steps: [
          {
            id: "step-flow",
            intent: "Check foreign participation",
            tool: "get_foreign_flow",
            input: {},
          },
          {
            id: "step-unknown",
            intent: "Attempt an unapproved call",
            tool: "not_registered",
            input: {},
          },
        ],
      }),
      tools: [foreignFlowTool, brokerTool],
      synthesizer: async () => ({
        driver: "FLOW_DRIVEN",
        classification: "bullish",
        confidence: 0.8,
        whatChanged: "Price rose with unusual volume.",
        whyItMatters: "The move is stronger than the market.",
        explanation: "Foreign participation is the most consistent signal.",
        whatToMonitor: "Foreign flow and volume.",
        changesSincePrevious: null,
      }),
    };

    const graph = buildStockInvestigatorGraph(dependencies);
    const result = await graph.invoke({ ticker: "ANTM", question: "Why did ANTM move?" });

    expect(result.status).toBe("completed");
    expect(result.signals?.relativeReturn).toBeCloseTo(0.05);
    expect(result.plan?.steps.map((step) => step.tool)).toEqual([
      "get_foreign_flow",
      "not_registered",
    ]);
    expect(calledTools).toEqual(["get_foreign_flow"]);
    expect(result.toolCalls.map((call) => [call.toolName, call.status])).toEqual([
      ["get_foreign_flow", "succeeded"],
      ["not_registered", "failed"],
    ]);
    expect(result.evidence.map((item) => item.type)).toEqual(["price_volume", "foreign_flow"]);
    expect(result.result?.driver).toBe("FLOW_DRIVEN");
  });
});
