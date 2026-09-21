import { Hono, type Context } from "hono";
import { runInvestigationConversation } from "../agents/stock-investigator/conversation.ts";
import { runStockInvestigation } from "../agents/stock-investigator/runner.ts";
import { createProductionDependencies } from "../agents/stock-investigator/runtime.ts";
import { requireSession } from "../auth-middleware.ts";
import { auth } from "../auth.ts";
import { PostgresInvestigationStore } from "../db/investigations.ts";
import { PostgresWatchlistStore } from "../db/watchlists.ts";
import { healthRoutes } from "./health.ts";
import { createInvestigationRoutes, InvestigationRunManager } from "./investigations.ts";
import { createWatchlistRoutes } from "./watchlist.ts";

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
});
apiRoutes.route("/investigations", investigationRoutes);

const watchlistRoutes = createWatchlistRoutes({
  store: new PostgresWatchlistStore(),
  authMiddleware: requireSession,
  resolveUserId: resolveSessionUserId,
});
apiRoutes.route("/watchlist", watchlistRoutes);

function resolveSessionUserId(context: Context): string {
  const session = context.get("session") as typeof auth.$Infer.Session;
  return session.user.id;
}
