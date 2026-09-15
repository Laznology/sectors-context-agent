import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { apiRoutes } from "./api/index.ts";

/**
 * Server entry point.
 *
 * Holds every secret and AI call: the browser only talks to `/api/*`, which Vite
 * proxies to this process during development.
 */
export const app = new Hono();

app.route("/api", apiRoutes);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[sector-context-agent] API listening on http://localhost:${info.port}`);
});
