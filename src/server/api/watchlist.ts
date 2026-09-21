import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { TickerSchema } from "../../shared/schemas/investigation.ts";
import type { WatchlistStore } from "../db/watchlists.ts";
import { PaginationSchema, readJson } from "./investigations.ts";

const WatchlistRequestSchema = z.object({ ticker: TickerSchema });

export type WatchlistRouteDependencies = {
  readonly store: WatchlistStore;
  readonly authMiddleware: MiddlewareHandler;
  readonly resolveUserId: (context: Context) => string;
  /** Returns `null` when Sectors has no record for the ticker. */
  readonly verifyTicker?: (
    ticker: string,
    signal?: AbortSignal,
  ) => Promise<{ companyName: string } | null>;
};

export function createWatchlistRoutes(dependencies: WatchlistRouteDependencies): Hono {
  const routes = new Hono();

  routes.use("*", dependencies.authMiddleware);

  routes.get("/", async (context) => {
    const userId = dependencies.resolveUserId(context);
    // `?view=dashboard` returns the same list enriched with company name, last
    // close, and last investigation so the dashboard needs one call, not N+1.
    if (context.req.query("view") === "dashboard") {
      return context.json({ watchlist: await dependencies.store.dashboard(userId) });
    }

    const pagination = PaginationSchema.safeParse({
      limit: context.req.query("limit"),
      offset: context.req.query("offset"),
    });
    if (!pagination.success) {
      return context.json(
        { error: "Invalid pagination", details: pagination.error.flatten() },
        400,
      );
    }

    const { limit, offset } = pagination.data;
    const rows = await dependencies.store.list(userId, { limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    return context.json({
      watchlist: hasMore ? rows.slice(0, limit) : rows,
      pagination: { limit, offset, hasMore },
    });
  });

  routes.post("/", async (context) => {
    const body = await readJson(context);
    const parsed = WatchlistRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json({ error: "Invalid ticker", details: parsed.error.flatten() }, 400);
    }

    const ticker = parsed.data.ticker;
    if (dependencies.verifyTicker) {
      let known: { companyName: string } | null;
      try {
        known = await dependencies.verifyTicker(ticker, context.req.raw.signal);
      } catch (error) {
        return context.json(
          {
            error: "Could not verify ticker with Sectors",
            message: error instanceof Error ? error.message : String(error),
          },
          502,
        );
      }
      if (!known) {
        return context.json({ error: `Sectors has no stock record for ${ticker}` }, 404);
      }
    }

    await dependencies.store.add(dependencies.resolveUserId(context), ticker);
    return context.json({ ticker }, 201);
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
