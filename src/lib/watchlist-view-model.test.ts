import { describe, expect, it } from "vite-plus/test";
import { toWatchlistItems } from "./watchlist-view-model.ts";

describe("toWatchlistItems", () => {
  it("maps the dashboard payload into render-ready cards", () => {
    const items = toWatchlistItems({
      watchlist: [
        {
          ticker: "ANTM",
          createdAt: "2026-09-21T02:50:22.443Z",
          companyName: "Aneka Tambang Tbk.",
          lastClose: 3340,
          lastCloseDate: "2026-09-30",
          lastInvestigation: {
            id: "inv-1",
            status: "completed",
            statusLabel: "attention",
            createdAt: "2026-09-30T01:00:00.000Z",
            completedAt: "2026-09-30T01:05:00.000Z",
          },
        },
      ],
    });

    expect(items).toEqual([
      {
        ticker: "ANTM",
        companyName: "Aneka Tambang Tbk.",
        latestClose: 3340,
        investigationStatus: "COMPLETED",
        lastInvestigatedAt: "2026-09-30T01:05:00.000Z",
        investigationId: "inv-1",
      },
    ]);
  });

  it("treats a ticker without investigations as NOT STARTED", () => {
    const [item] = toWatchlistItems({
      watchlist: [{ ticker: "BBCA", createdAt: "2026-09-19T00:00:00.000Z" }],
    });

    expect(item.investigationStatus).toBe("NONE");
    expect(item.investigationId).toBeNull();
    expect(item.lastInvestigatedAt).toBeNull();
    expect(item.latestClose).toBeNull();
    expect(item.companyName).toBe("");
  });

  it("maps in-flight and failed pipeline stages to their badge states", () => {
    const running = toWatchlistItems({
      watchlist: [
        {
          ticker: "TLKM",
          createdAt: "2026-09-19T00:00:00.000Z",
          lastInvestigation: {
            id: "inv-2",
            status: "investigating",
            createdAt: "2026-09-30T01:00:00.000Z",
            completedAt: null,
          },
        },
      ],
    })[0];

    const failed = toWatchlistItems({
      watchlist: [
        {
          ticker: "GOTO",
          createdAt: "2026-09-19T00:00:00.000Z",
          lastInvestigation: {
            id: "inv-3",
            status: "failed",
            createdAt: "2026-09-30T01:00:00.000Z",
            completedAt: null,
          },
        },
      ],
    })[0];

    expect(running.investigationStatus).toBe("IN_PROGRESS");
    expect(running.lastInvestigatedAt).toBe("2026-09-30T01:00:00.000Z");
    expect(failed.investigationStatus).toBe("FAILED");
  });

  it("tolerates a missing watchlist array", () => {
    expect(toWatchlistItems({})).toEqual([]);
  });
});
