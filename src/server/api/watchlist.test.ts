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

describe("watchlist API", () => {
  it("lists the watchlist for the authenticated user", async () => {
    const list = vi
      .fn()
      .mockResolvedValue([{ ticker: "BBCA", createdAt: "2026-09-19T00:00:00.000Z" }]);

    const response = await buildApp({ list, add: vi.fn(), remove: vi.fn() }).request(
      "http://localhost/",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ watchlist: [{ ticker: "BBCA" }] });
    expect(list).toHaveBeenCalledWith("user-1");
  });

  it("adds a normalized ticker", async () => {
    const add = vi.fn();

    const response = await buildApp({ list: vi.fn(), add, remove: vi.fn() }).request(
      "http://localhost/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: " bbca.jk " }),
      },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ticker: "BBCA" });
    expect(add).toHaveBeenCalledWith("user-1", "BBCA");
  });

  it("rejects a malformed ticker before touching the store", async () => {
    const add = vi.fn();

    const response = await buildApp({ list: vi.fn(), add, remove: vi.fn() }).request(
      "http://localhost/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: "ABC" }),
      },
    );

    expect(response.status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });

  it("removes a ticker", async () => {
    const remove = vi.fn();

    const response = await buildApp({ list: vi.fn(), add: vi.fn(), remove }).request(
      "http://localhost/antm",
      { method: "DELETE" },
    );

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("user-1", "ANTM");
  });
});
