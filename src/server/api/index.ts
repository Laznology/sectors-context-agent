import { Hono } from "hono";
import { runStockInvestigation } from "../agents/stock-investigator/runner.ts";
import { createProductionDependencies } from "../agents/stock-investigator/runtime.ts";
import { requireSession } from "../auth-middleware.ts";
import { auth } from "../auth.ts";
import { PostgresInvestigationStore } from "../db/investigations.ts";
import { healthRoutes } from "./health.ts";
import { createInvestigationRoutes, InvestigationRunManager } from "./investigations.ts";

/** Mounted under `/api` by the server entry point. */
export const apiRoutes = new Hono();

apiRoutes.route("/", healthRoutes);

apiRoutes.all("/auth/*", (c) => auth.handler(c.req.raw));

apiRoutes.use("/watchlist", requireSession);
apiRoutes.use("/watchlist/*", requireSession);
apiRoutes.get("/me", requireSession, (c) => c.json({ user: c.get("session").user }));
const investigationStore = new PostgresInvestigationStore();
const investigationManager = new InvestigationRunManager(async (input, emit) => {
  await runStockInvestigation(input, createProductionDependencies(), investigationStore, emit);
});

const investigationRoutes = createInvestigationRoutes({
  store: investigationStore,
  manager: investigationManager,
  authMiddleware: requireSession,
  resolveUserId: (context) => {
    const session = context.get("session") as typeof auth.$Infer.Session;
    return session.user.id;
  },
});
apiRoutes.route("/investigations", investigationRoutes);
