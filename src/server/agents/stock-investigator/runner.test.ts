import { describe, expect, it, vi } from "vite-plus/test";
import { calculateSignals } from "../../analysis/signals.ts";
import type { InvestigationStore } from "../../db/investigations.ts";
import type { StockInvestigatorDependencies } from "./graph.ts";
import { runStockInvestigation, type InvestigationEvent } from "./runner.ts";

describe("runStockInvestigation", () => {
  it("persists streamed graph stages and completes with the synthesized result", async () => {
    const updateFromState = vi.fn();
    const complete = vi.fn();
    const fail = vi.fn();
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState,
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete,
      fail,
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
        evidence: [],
        toolCalls: [],
      }),
      calculateSignals,
      planner: async () => ({ hypotheses: [], steps: [] }),
      tools: [],
      synthesizer: async () => ({
        driver: "UNCLEAR",
        classification: "inconclusive",
        status: "unclear",
        confidence: 0.2,
        confidenceReason: "Evidence is missing or conflicting.",
        whatChanged: "No movement data was available.",
        whyItMatters: "The available evidence is insufficient.",
        explanation: "No conclusion can be drawn from missing data.",
        whatToMonitor: ["Collect a new baseline.", "Check that Sectors returned daily data."],
        evidenceSummary: [
          { label: "Price/Volume", finding: "No data available", importance: "low" },
        ],
        changesSincePrevious: null,
        disclaimer: "This analysis is informational and does not constitute investment advice.",
      }),
    };
    const events: InvestigationEvent[] = [];

    await runStockInvestigation(
      {
        investigationId: "inv-1",
        userId: "user-1",
        ticker: "ANTM",
        previousInvestigation: null,
      },
      dependencies,
      store,
      (event) => events.push(event),
    );

    expect(events.map((event) => event.type)).toEqual([
      "started",
      "step",
      "step",
      "plan",
      "step",
      "step",
      "step",
      "step",
      "completed",
    ]);
    expect(events.filter((event) => event.type === "step").map((event) => event.step)).toEqual([
      "collectBaseline",
      "calculateSignals",
      "planInvestigation",
      "investigateEvidence",
      "synthesize",
      "finalize",
    ]);
    expect(
      events.filter((event) => event.type === "step").every((event) => event.label.length > 0),
    ).toBe(true);
    expect(events.find((event) => event.type === "plan")).toMatchObject({
      branch: "full",
      hypotheses: [],
    });
    expect(updateFromState).toHaveBeenCalledTimes(6);
    expect(complete).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });
  it("persists a failed run when a graph stage throws", async () => {
    const fail = vi.fn();
    const complete = vi.fn();
    const store: InvestigationStore = {
      create: vi.fn(),
      findPrevious: vi.fn(),
      getDetail: vi.fn(),
      list: vi.fn(),
      updateFromState: vi.fn(),
      appendEvidence: vi.fn(),
      appendToolCalls: vi.fn(),
      appendConversation: vi.fn(),
      complete,
      fail,
    };
    const dependencies: StockInvestigatorDependencies = {
      collectBaseline: async () => {
        throw new Error("Sectors unavailable");
      },
      calculateSignals,
      planner: async () => ({ hypotheses: [], steps: [] }),
      tools: [],
      synthesizer: async () => {
        throw new Error("Synthesis should not run");
      },
    };
    const events: InvestigationEvent[] = [];

    await runStockInvestigation(
      {
        investigationId: "inv-2",
        userId: "user-1",
        ticker: "ANTM",
        previousInvestigation: null,
      },
      dependencies,
      store,
      (event) => events.push(event),
    );

    expect(fail).toHaveBeenCalledWith("inv-2", "Sectors unavailable");
    expect(complete).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "error", message: "Sectors unavailable" });
  });
});
