import { Hono, type Context } from "hono";
import { runInvestigationConversation } from "../agents/stock-investigator/conversation.ts";
import { runStockInvestigation } from "../agents/stock-investigator/runner.ts";
import { createProductionDependencies } from "../agents/stock-investigator/runtime.ts";
import { requireSession } from "../auth-middleware.ts";
import { auth } from "../auth.ts";
import { PostgresInvestigationStore } from "../db/investigations.ts";
import { PostgresWatchlistStore } from "../db/watchlists.ts";
import { fetchCompanyOverview } from "../sectors/company.ts";
import { healthRoutes } from "./health.ts";
import { createInvestigationRoutes, InvestigationRunManager } from "./investigations.ts";
import { createWatchlistRoutes } from "./watchlist.ts";
import { streamSSE } from "hono/streaming";

export const apiRoutes = new Hono();

apiRoutes.route("/", healthRoutes);

apiRoutes.all("/auth/*", (c) => auth.handler(c.req.raw));

apiRoutes.get("/me", requireSession, (c) => c.json({ user: c.get("session").user }));

const investigationStore = new PostgresInvestigationStore();
const investigationManager = new InvestigationRunManager(async (input, emit) => {
  await runStockInvestigation(input, createProductionDependencies(), investigationStore, emit);
});

const investigationRoutes = createInvestigationRoutes({
  store: investigationStore,
  manager: investigationManager,
  conversation: (input) => runInvestigationConversation(input, investigationStore),
  authMiddleware: requireSession,
  resolveUserId: resolveSessionUserId,
  verifyTicker: (ticker, signal) => fetchCompanyOverview(ticker, signal),
});
apiRoutes.route("/investigations", investigationRoutes);

const watchlistRoutes = createWatchlistRoutes({
  store: new PostgresWatchlistStore(),
  authMiddleware: requireSession,
  resolveUserId: resolveSessionUserId,
  verifyTicker: (ticker, signal) => fetchCompanyOverview(ticker, signal),
});
apiRoutes.route("/watchlist", watchlistRoutes);

function resolveSessionUserId(context: Context): string {
  const session = context.get("session") as typeof auth.$Infer.Session;
  return session.user.id;
}

const app = new Hono();

// Wajib mencocokkan route path: /api/investigations/:id/events
app.get("/api/investigations/:id/events", async (c) => {
  const id = c.req.param("id");

  // Set header anti-buffering & event-stream
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    // Contoh pengiriman event awal
    await stream.writeSSE({
      data: JSON.stringify({
        status: "collecting_baseline",
        currentTool: {
          toolName: "MarketDataFetcher",
          reason: `Mengambil data historis ticker ${id.toUpperCase()}`,
        },
      }),
      event: "message",
    });
  });
});

export default app;
