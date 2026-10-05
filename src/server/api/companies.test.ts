import { type MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  CompanyScreenerResponseSchema,
  type CompanyScreenerResponse,
} from "../../shared/schemas/company-search.ts";
import { searchCompaniesMock } from "../sectors/company-search-mock.ts";
import { createCompanySearchRoutes } from "./companies.ts";

const allowRequest: MiddlewareHandler = async (_context, next) => next();

const screenerResponse: CompanyScreenerResponse = {
  results: [{ symbol: "BBCA.JK", company_name: "PT Bank Central Asia Tbk." }],
  pagination: {
    total_count: 1,
    showing: 1,
    limit: 10,
    offset: 0,
    has_next: false,
    has_previous: false,
    next_offset: null,
    previous_offset: null,
  },
  llm_translation: {
    natural_query: null,
    translated_params: {
      where: "symbol like '%bbca%' or company_name like '%bbca%'",
      order_by: "symbol",
      limit: 10,
      offset: 0,
      include_query_values: false,
    },
    message: null,
  },
};

describe("company search API", () => {
  it("returns Sectors Companies Screener results and passes bounded search input through", async () => {
    const searchCompanies = vi.fn().mockResolvedValue(screenerResponse);
    const routes = createCompanySearchRoutes({ authMiddleware: allowRequest, searchCompanies });

    const response = await routes.request("http://localhost/?q=bbca");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(screenerResponse);
    expect(searchCompanies).toHaveBeenCalledWith(
      { query: "bbca", limit: 10, offset: 0 },
      expect.any(AbortSignal),
    );
  });

  it("serves a broad demo directory in the real Companies Screener response shape", async () => {
    const routes = createCompanySearchRoutes({
      authMiddleware: allowRequest,
      searchCompanies: searchCompaniesMock,
    });

    const response = await routes.request("http://localhost/?limit=50");
    const parsed = CompanyScreenerResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.results.length).toBeGreaterThanOrEqual(40);
    expect(parsed.data.results).toContainEqual({
      symbol: "BBCA.JK",
      company_name: "PT Bank Central Asia Tbk.",
    });
    expect(parsed.data.results).toContainEqual({
      symbol: "ANTM.JK",
      company_name: "Aneka Tambang Tbk.",
    });
    expect(parsed.data.pagination.total_count).toBeGreaterThanOrEqual(parsed.data.results.length);
  });

  it("rejects filter syntax before forwarding a query to the search provider", async () => {
    const searchCompanies = vi.fn().mockResolvedValue(screenerResponse);
    const routes = createCompanySearchRoutes({ authMiddleware: allowRequest, searchCompanies });

    const response = await routes.request("http://localhost/?q=%27%20OR%201%3D1");

    expect(response.status).toBe(400);
    expect(searchCompanies).not.toHaveBeenCalled();
  });
});
