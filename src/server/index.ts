import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "node:fs";
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
  if (error instanceof HTTPException) {
    return context.json({ error: error.message }, error.status);
  }

  if (error instanceof ZodError) {
    return context.json(
      { error: "Invalid request", details: error.flatten() },
      400 as ContentfulStatusCode,
    );
  }

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

// Client-side routes (/sign-in, /investigations/BBRI) are not files: any GET
// outside /api gets the built shell. Read once at boot; dist/ is absent in dev,
// where Vite serves the shell itself.
const spaShell = (() => {
  try {
    return readFileSync(new URL("../../dist/index.html", import.meta.url), "utf8");
  } catch {
    return undefined;
  }
})();

app.notFound((context) => {
  const path = context.req.path;
  if (spaShell && context.req.method === "GET" && !path.startsWith("/api")) {
    context.header("Cache-Control", "no-cache");
    return context.html(spaShell);
  }
  return context.json({ error: `No route for ${context.req.method} ${path}` }, 404);
});

const MAX_BODY_BYTES = 64 * 1024;
app.use("*", async (context, next) => {
  const length = Number(context.req.header("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return context.json({ error: "Request body too large" }, 413);
  }
  await next();
});

app.route("/api", apiRoutes);

// Production serves the built SPA from this same process: one port, one image.
// ponytail: hashed filenames make /assets immutable; index.html is revalidated.
// Move assets behind a CDN when static traffic outnumbers /api traffic.
app.use("/assets/*", async (context, next) => {
  context.header("Cache-Control", "public, max-age=31536000, immutable");
  await next();
});
app.use("/assets/*", serveStatic({ root: "./dist" }));

// Root-level static files (favicons, web app manifest) live at dist/ root, not
// under /assets. Without this they fall through to the SPA shell, so the browser
// receives index.html for /favicon.ico and shows no icon.
const STATIC_ROOT_FILES = [
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/icons.svg",
  "/site.webmanifest",
] as const;
for (const file of STATIC_ROOT_FILES) {
  app.get(file, serveStatic({ root: "./dist" }));
}

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

    setTimeout(() => {
      console.error("[sector-context-agent] shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  });
}
