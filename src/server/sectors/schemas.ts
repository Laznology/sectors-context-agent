import { z } from "zod";

/**
 * Loose envelope for Sectors REST API v2 error responses.
 *
 * Endpoint-specific response schemas are added together with the endpoints
 * themselves; this one only needs to be good enough for error reporting.
 */
export const SectorsErrorResponseSchema = z.looseObject({
  error: z.string().optional(),
  message: z.string().optional(),
  detail: z.unknown().optional(),
});

export type SectorsErrorResponse = z.infer<typeof SectorsErrorResponseSchema>;
