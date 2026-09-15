import { Hono } from "hono";
import { healthRoutes } from "./health.ts";

/** Mounted under `/api` by the server entry point. */
export const apiRoutes = new Hono();

apiRoutes.route("/", healthRoutes);
