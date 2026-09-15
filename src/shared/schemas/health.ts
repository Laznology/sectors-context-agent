import { z } from "zod";

export const HEALTH_SERVICE_NAME = "sector-context-agent";

/** Response body of `GET /api/health`. */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal(HEALTH_SERVICE_NAME),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
