import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  CompanyScreenerResponseSchema,
  type CompanyScreenerResponse,
} from "../../shared/schemas/company-search.ts";

const CompanySearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(60)
    .regex(/^[\p{L}\p{N}\s&.,()/-]*$/u)
    .default(""),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

type CompanySearchInput = {
  readonly query: string;
  readonly limit: number;
  readonly offset: number;
};

export type CompanySearchRoutesDependencies = {
  readonly authMiddleware: MiddlewareHandler;
  readonly searchCompanies: (
    input: CompanySearchInput,
    signal: AbortSignal,
  ) => Promise<CompanyScreenerResponse>;
};

export function createCompanySearchRoutes(dependencies: CompanySearchRoutesDependencies): Hono {
  const routes = new Hono();
  routes.use("*", dependencies.authMiddleware);

  routes.get("/", async (context) => {
    const parsed = CompanySearchQuerySchema.safeParse({
      q: context.req.query("q"),
      limit: context.req.query("limit"),
      offset: context.req.query("offset"),
    });
    if (!parsed.success) {
      return context.json(
        { error: "Parameter pencarian perusahaan tidak valid.", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const response = await dependencies.searchCompanies(
        {
          query: parsed.data.q,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        },
        context.req.raw.signal,
      );
      return context.json(CompanyScreenerResponseSchema.parse(response));
    } catch {
      return context.json({ error: "Pencarian perusahaan belum tersedia." }, 502);
    }
  });

  return routes;
}
