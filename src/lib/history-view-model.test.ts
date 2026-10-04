import { describe, expect, it } from "vite-plus/test";
import { groupHistory, toTimeline } from "./history-view-model.ts";

describe("groupHistory", () => {
  it("groups runs by ticker, newest ticker and newest run first", () => {
    const groups = groupHistory([
      {
        id: "a1",
        ticker: "ANTM",
        companyName: "Aneka Tambang Tbk.",
        status: "completed",
        driver: "FLOW_DRIVEN",
        confidence: 0.55,
        whatChanged: "Naik 4,1% dengan volume 1,8x.",
        createdAt: "2026-09-28T02:00:00Z",
        completedAt: "2026-09-28T02:01:00Z",
      },
      {
        id: "b1",
        ticker: "BBCA",
        companyName: null,
        status: "failed",
        createdAt: "2026-09-30T02:00:00Z",
      },
      {
        id: "a2",
        ticker: "ANTM",
        status: "investigating",
        createdAt: "2026-10-01T02:00:00Z",
      },
    ]);

    expect(groups.map((group) => group.ticker)).toEqual(["ANTM", "BBCA"]);
    expect(groups[0].companyName).toBe("Aneka Tambang Tbk.");
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["a2", "a1"]);
    expect(groups[0].entries[1]).toEqual({
      id: "a1",
      status: "COMPLETED",
      driver: "FLOW_DRIVEN",
      confidence: "MEDIUM",
      summary: "Naik 4,1% dengan volume 1,8x.",
      date: "2026-09-28T02:01:00Z",
    });
    expect(groups[0].entries[0]).toMatchObject({
      status: "IN_PROGRESS",
      driver: null,
      confidence: null,
      summary: "",
    });
    expect(groups[1].entries[0].status).toBe("FAILED");
  });

  it("returns no groups for an empty history", () => {
    expect(groupHistory([])).toEqual([]);
  });
});

describe("toTimeline", () => {
  const runs = [
    {
      id: "old",
      ticker: "ANTM",
      status: "completed",
      driver: "MARKET_DRIVEN" as const,
      confidence: 0.5,
      whatChanged: "Moved with the market.",
      changesSincePrevious: null,
      createdAt: "2026-09-29T01:00:00Z",
      completedAt: "2026-09-29T01:05:00Z",
    },
    {
      id: "new",
      ticker: "ANTM",
      status: "completed",
      driver: "FLOW_DRIVEN" as const,
      confidence: 0.8,
      whatChanged: "Foreign inflow strengthened.",
      changesSincePrevious: "Foreign inflow continued since the prior run.",
      createdAt: "2026-10-02T01:00:00Z",
      completedAt: "2026-10-02T01:05:00Z",
    },
  ];

  it("returns that ticker's runs newest first, marking the current one", () => {
    const entries = toTimeline(runs, "ANTM", "new");

    expect(entries.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(entries[0].isCurrent).toBe(true);
    expect(entries[1].isCurrent).toBe(false);
  });

  it("carries date, driver, confidence and summary per entry", () => {
    const [entry] = toTimeline(runs, "ANTM", "new");

    expect(entry.date).toBe("2026-10-02T01:05:00Z");
    expect(entry.driver).toBe("FLOW_DRIVEN");
    expect(entry.confidence).toBe("HIGH");
    expect(entry.summary).toBe("Foreign inflow strengthened.");
  });

  it("shows a delta only when a change since the previous run is recorded", () => {
    const entries = toTimeline(runs, "ANTM", "new");

    expect(entries[0].delta).toBe("Foreign inflow continued since the prior run.");
    expect(entries[1].delta).toBeNull();
  });

  it("produces a single-entry timeline with no delta for one run", () => {
    const entries = toTimeline([runs[1]], "ANTM", "new");

    expect(entries).toHaveLength(1);
    expect(entries[0].isCurrent).toBe(true);
    expect(entries[0].delta).toBe("Foreign inflow continued since the prior run.");
  });

  it("returns an empty timeline for a ticker with no runs", () => {
    expect(toTimeline(runs, "BBCA", "new")).toEqual([]);
  });
});
