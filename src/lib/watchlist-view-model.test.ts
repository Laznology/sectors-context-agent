import { describe, expect, it } from "vite-plus/test";
import { toWatchlistItems, type WatchlistDashboardResponse } from "./watchlist-view-model.ts";

const SESSION = "2026-10-02";

type DashboardEntry = NonNullable<WatchlistDashboardResponse["watchlist"]>[number];

function item(entry: DashboardEntry, session = SESSION) {
  const [card] = toWatchlistItems({ watchlist: [entry] }, { latestSession: session });
  return card;
}

describe("toWatchlistItems", () => {
  it("maps the dashboard payload into render-ready cards", () => {
    const card = item({
      ticker: "ANTM",
      createdAt: "2026-09-21T02:50:22.443Z",
      companyName: "Aneka Tambang Tbk.",
      lastClose: 3340,
      lastCloseDate: "2026-10-02",
      runCount: 3,
      lastInvestigation: {
        id: "inv-1",
        status: "completed",
        statusLabel: "attention",
        driver: "FLOW_DRIVEN",
        createdAt: "2026-10-02T01:00:00.000Z",
        completedAt: "2026-10-02T01:05:00.000Z",
        asOfDate: "2026-10-02",
      },
    });

    expect(card).toEqual({
      ticker: "ANTM",
      companyName: "Aneka Tambang Tbk.",
      latestClose: 3340,
      latestCloseDate: "2026-10-02",
      investigationStatus: "COMPLETED",
      lastInvestigatedAt: "2026-10-02T01:05:00.000Z",
      investigationId: "inv-1",
      driver: "FLOW_DRIVEN",
      statusLabel: "attention",
      runCount: 3,
      continuity: "FRESH",
      primaryAction: "OPEN_REPORT",
      actionReason: "Laporan dari 2 Okt",
    });
  });

  it("treats a ticker without investigations as NOT STARTED", () => {
    const card = item({ ticker: "BBCA", createdAt: "2026-09-19T00:00:00.000Z" });

    expect(card.investigationStatus).toBe("NONE");
    expect(card.latestCloseDate).toBeNull();
    expect(card.driver).toBeNull();
    expect(card.statusLabel).toBeNull();
    expect(card.runCount).toBe(0);
    expect(card.continuity).toBe("NONE");
    expect(card.primaryAction).toBe("INVESTIGATE");
    expect(card.actionReason).toBe("Belum ada investigasi");
  });

  it("offers Open report while a run is still in progress", () => {
    const card = item({
      ticker: "GOTO",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 1,
      lastInvestigation: {
        id: "inv-2",
        status: "investigating",
        statusLabel: null,
        driver: null,
        createdAt: "2026-10-04T01:00:00.000Z",
        completedAt: null,
        asOfDate: null,
      },
    });

    expect(card.continuity).toBe("RUNNING");
    expect(card.primaryAction).toBe("OPEN_REPORT");
    expect(card.actionReason).toBe("Investigasi sedang berjalan");
  });

  it("offers Update when a newer session exists than the last run", () => {
    const card = item({
      ticker: "BBRI",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 2,
      lastInvestigation: {
        id: "inv-3",
        status: "completed",
        statusLabel: "normal",
        driver: "MARKET_DRIVEN",
        createdAt: "2026-09-29T01:00:00.000Z",
        completedAt: "2026-09-29T01:05:00.000Z",
        asOfDate: "2026-09-29",
      },
    });

    expect(card.continuity).toBe("STALE");
    expect(card.primaryAction).toBe("UPDATE");
    expect(card.actionReason).toBe("Sesi data baru tersedia sejak investigasi terakhir");
  });

  it("treats a failed last run as having no current report", () => {
    const card = item({
      ticker: "TLKM",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 1,
      lastInvestigation: {
        id: "inv-4",
        status: "failed",
        statusLabel: null,
        driver: null,
        createdAt: "2026-10-01T01:00:00.000Z",
        completedAt: null,
        asOfDate: null,
      },
    });

    expect(card.continuity).toBe("NONE");
    expect(card.primaryAction).toBe("INVESTIGATE");
  });

  it("does not crash when driver or attention state is missing", () => {
    const card = item({
      ticker: "ASII",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 1,
      lastInvestigation: {
        id: "inv-5",
        status: "completed",
        createdAt: "2026-10-02T01:00:00.000Z",
        completedAt: "2026-10-02T01:05:00.000Z",
        asOfDate: "2026-10-02",
      },
    });

    expect(card.driver).toBeNull();
    expect(card.statusLabel).toBeNull();
    expect(card.continuity).toBe("FRESH");
    expect(card.primaryAction).toBe("OPEN_REPORT");
  });

  it("treats a completed run with no as-of date as current", () => {
    const card = item({
      ticker: "UNVR",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 1,
      lastInvestigation: {
        id: "inv-6",
        status: "completed",
        statusLabel: "unclear",
        driver: "UNCLEAR",
        createdAt: "2026-10-02T01:00:00.000Z",
        completedAt: "2026-10-02T01:05:00.000Z",
        asOfDate: null,
      },
    });

    expect(card.statusLabel).toBe("unclear");
    expect(card.continuity).toBe("FRESH");
    expect(card.primaryAction).toBe("OPEN_REPORT");
  });

  it("falls back to the start time when a run has no completion time", () => {
    const card = item({
      ticker: "SMGR",
      createdAt: "2026-09-19T00:00:00.000Z",
      runCount: 1,
      lastInvestigation: {
        id: "inv-7",
        status: "completed",
        statusLabel: "normal",
        driver: "MIXED",
        createdAt: "2026-10-02T01:00:00.000Z",
        completedAt: null,
        asOfDate: "2026-10-02",
      },
    });

    expect(card.lastInvestigatedAt).toBe("2026-10-02T01:00:00.000Z");
    expect(card.continuity).toBe("FRESH");
    expect(card.actionReason).toBe("Laporan dari 2 Okt");
  });
});
