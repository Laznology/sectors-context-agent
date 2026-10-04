import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";
import type { WatchlistStore } from "../db/watchlists.ts";
import { createWatchlistRoutes } from "./watchlist.ts";

const allowRequest: MiddlewareHandler = async (_context, next) => next();

function buildApp(store: WatchlistStore) {
  return createWatchlistRoutes({
    store,
    authMiddleware: allowRequest,
    resolveUserId: () => "user-1",
  });
}

function emptyStore(overrides: Partial<WatchlistStore> = {}): WatchlistStore {
  return { list: vi.fn(), add: vi.fn(), remove: vi.fn(), dashboard: vi.fn(), ...overrides };
}

describe("watchlist API", () => {
  it("lists the watchlist for the authenticated user", async () => {
    const list = vi
      .fn()
      .mockResolvedValue([{ ticker: "BBCA", createdAt: "2026-09-19T00:00:00.000Z" }]);

    const response = await buildApp(emptyStore({ list })).request("http://localhost/");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ watchlist: [{ ticker: "BBCA" }] });
    expect(list).toHaveBeenCalledWith("user-1", { limit: 51, offset: 0 });
  });

  it("adds a normalized ticker", async () => {
    const add = vi.fn();

    const response = await buildApp(emptyStore({ add })).request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: " bbca.jk " }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ticker: "BBCA" });
    expect(add).toHaveBeenCalledWith("user-1", "BBCA");
  });

  it("rejects a malformed ticker before touching the store", async () => {
    const add = vi.fn();

    const response = await buildApp(emptyStore({ add })).request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: "ABC" }),
    });

    expect(response.status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });

  it("returns the continuity fields the watchlist cards need", async () => {
    const dashboard = vi.fn().mockResolvedValue([
      {
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
      },
    ]);

    const response = await buildApp(emptyStore({ dashboard })).request(
      "http://localhost/?view=dashboard",
    );
    const body = (await response.json()) as {
      watchlist: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(dashboard).toHaveBeenCalledWith("user-1");
    expect(body.watchlist[0]).toMatchObject({
      runCount: 3,
      lastInvestigation: {
        driver: "FLOW_DRIVEN",
        statusLabel: "attention",
        asOfDate: "2026-10-02",
      },
    });
  });

  it("removes a ticker", async () => {
    const remove = vi.fn();

    const response = await buildApp(emptyStore({ remove })).request("http://localhost/antm", {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("user-1", "ANTM");
  });
});
