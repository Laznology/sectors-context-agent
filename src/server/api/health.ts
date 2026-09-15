import { Hono } from "hono";
import { HEALTH_SERVICE_NAME, HealthResponseSchema } from "../../shared/schemas/health.ts";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  const payload = HealthResponseSchema.parse({
    ok: true,
    service: HEALTH_SERVICE_NAME,
  });

  return c.json(payload);
});
