import { Hono, type Context } from "hono";
import { runInvestigationConversation } from "../agents/stock-investigator/conversation.ts";
import { runStockInvestigation } from "../agents/stock-investigator/runner.ts";
import { createProductionDependencies } from "../agents/stock-investigator/runtime.ts";
import { requireSession } from "../auth-middleware.ts";
import { auth } from "../auth.ts";
import { PostgresInvestigationStore } from "../db/investigations.ts";
import { PostgresWatchlistStore } from "../db/watchlists.ts";
import { searchCompaniesMock } from "../sectors/company-search-mock.ts";
import { fetchCompanyOverview } from "../sectors/company.ts";
import { createCompanySearchRoutes } from "./companies.ts";
import { healthRoutes } from "./health.ts";
import { createInvestigationRoutes, InvestigationRunManager } from "./investigations.ts";
import { createWatchlistRoutes } from "./watchlist.ts";

export const apiRoutes = new Hono();

const investigationStore = new PostgresInvestigationStore();
const startupRecovery = investigationStore.recoverInterruptedRuns?.().then((count) => {
  if (count > 0) {
    console.warn(
      `[sector-context-agent] marked ${count} interrupted investigation(s) as failed after startup`,
    );
  }
});

apiRoutes.use("*", async (_context, next) => {
  await startupRecovery;
  await next();
});

apiRoutes.route("/", healthRoutes);

apiRoutes.all("/auth/*", (c) => auth.handler(c.req.raw));

apiRoutes.get("/me", requireSession, (c) => c.json({ user: c.get("session").user }));

const companySearchRoutes = createCompanySearchRoutes({
  authMiddleware: requireSession,
  searchCompanies: searchCompaniesMock,
});
apiRoutes.route("/companies/search", companySearchRoutes);

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
