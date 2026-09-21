import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { TickerSchema } from "../../shared/schemas/investigation.ts";
import type { WatchlistStore } from "../db/watchlists.ts";
import { readJson } from "./investigations.ts";

const WatchlistRequestSchema = z.object({ ticker: TickerSchema });

export type WatchlistRouteDependencies = {
  readonly store: WatchlistStore;
  readonly authMiddleware: MiddlewareHandler;
  readonly resolveUserId: (context: Context) => string;
};

export function createWatchlistRoutes(dependencies: WatchlistRouteDependencies): Hono {
  const routes = new Hono();

  routes.use("*", dependencies.authMiddleware);

  routes.get("/", async (context) => {
    const watchlist = await dependencies.store.list(dependencies.resolveUserId(context));
    return context.json({ watchlist });
  });

  routes.post("/", async (context) => {
    const body = await readJson(context);
    const parsed = WatchlistRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json({ error: "Invalid ticker", details: parsed.error.flatten() }, 400);
    }

    await dependencies.store.add(dependencies.resolveUserId(context), parsed.data.ticker);
    return context.json({ ticker: parsed.data.ticker }, 201);
  });

  routes.delete("/:ticker", async (context) => {
    const parsed = TickerSchema.safeParse(context.req.param("ticker"));
    if (!parsed.success) {
      return context.json({ error: "Invalid ticker", details: parsed.error.flatten() }, 400);
    }

    await dependencies.store.remove(dependencies.resolveUserId(context), parsed.data);
    return context.body(null, 204);
  });

  return routes;
}
