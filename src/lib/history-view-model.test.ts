import { describe, expect, it } from "vite-plus/test";
import { groupHistory, InvestigationListResponseSchema } from "./history-view-model.ts";

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

describe("InvestigationListResponseSchema", () => {
  it("rejects a payload without the investigations array", () => {
    expect(InvestigationListResponseSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
