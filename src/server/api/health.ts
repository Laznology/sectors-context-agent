import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { HEALTH_SERVICE_NAME, HealthResponseSchema } from "../../shared/schemas/health.ts";
import { getDb } from "../db/index.ts";

export const healthRoutes = new Hono();

/**
 * Liveness plus a database probe: a process that cannot reach Postgres is not
 * healthy, even though it is still accepting connections.
 */
healthRoutes.get("/health", async (c) => {
  let database: "ok" | "unavailable" = "ok";
  try {
    await getDb().execute(sql`select 1`);
  } catch (error) {
    database = "unavailable";
    console.error(
      JSON.stringify({
        scope: "health",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const payload = HealthResponseSchema.parse({
    ok: database === "ok",
    service: HEALTH_SERVICE_NAME,
  });

  return c.json({ ...payload, database }, database === "ok" ? 200 : 503);
});
