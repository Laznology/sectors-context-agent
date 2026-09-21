import { serve } from "@hono/node-server";
import "dotenv/config";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { apiRoutes } from "./api/index.ts";
import { closeDb } from "./db/index.ts";

/**
 * Server entry point.
 *
 * Holds every secret and AI call: the browser only talks to `/api/*`, which Vite
 * proxies to this process during development.
 */
export const app = new Hono();

app.onError((error, context) => {
  // Expected, deliberate failures: 401 from `requireSession`, 404 from a bad
  // route, and Zod failures at a boundary. These keep their own status.
  if (error instanceof HTTPException) {
    return context.json({ error: error.message }, error.status);
  }

  if (error instanceof ZodError) {
    return context.json(
      { error: "Invalid request", details: error.flatten() },
      400 as ContentfulStatusCode,
    );
  }

  // Anything else is a bug or an infrastructure failure. Log it with enough
  // context to reproduce, but never leak the stack trace to the client.
  console.error(
    JSON.stringify({
      scope: "request",
      at: new Date().toISOString(),
      method: context.req.method,
      path: context.req.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );

  return context.json({ error: "Internal server error" }, 500);
});

app.notFound((context) =>
  context.json({ error: `No route for ${context.req.method} ${context.req.path}` }, 404),
);

// JSON bodies here are small (a ticker, a question, a chat message). Reject
// oversized payloads before Hono buffers them into memory.
const MAX_BODY_BYTES = 64 * 1024;
app.use("*", async (context, next) => {
  const length = Number(context.req.header("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return context.json({ error: "Request body too large" }, 413);
  }
  await next();
});

app.route("/api", apiRoutes);

const port = Number(process.env.PORT ?? 3001);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[sector-context-agent] API listening on http://localhost:${info.port}`);
});

/**
 * Stops accepting connections, then closes the database pool so in-flight
 * queries are not killed mid-write. A second signal exits immediately.
 */
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) {
      console.log(`[sector-context-agent] ${signal} received again, exiting`);
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`[sector-context-agent] ${signal} received, shutting down`);

    server.close(async () => {
      await closeDb();
      console.log("[sector-context-agent] shutdown complete");
      process.exit(0);
    });

    // ponytail: hard deadline so a stuck connection cannot block exit forever.
    setTimeout(() => {
      console.error("[sector-context-agent] shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  });
}
