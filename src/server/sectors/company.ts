import { z } from "zod";
import { sectorsFetch } from "./client.ts";
import { SectorsApiError } from "./errors.ts";

/**
 * `company/report` overview section.
 *
 * `overview.sub_sector` is a display name ("Food & Beverage") while
 * `subsector/report/:slug` expects a slug ("food-beverage"), so callers must go
 * through `subsectorSlug` instead of passing the display name straight through.
 */
const CompanyOverviewSchema = z.looseObject({
  symbol: z.string().min(1),
  company_name: z.string().min(1),
  overview: z
    .looseObject({
      sector: z.string().min(1),
      sub_sector: z.string().min(1),
      industry: z.string().optional(),
      market_cap: z.number().optional(),
      last_close_price: z.number().optional(),
      latest_close_date: z.string().optional(),
      indices: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CompanyOverview = {
  /** Bare IDX symbol without the `.JK` suffix, e.g. `ANTM`. */
  readonly ticker: string;
  readonly companyName: string;
  readonly sector: string | null;
  readonly subSector: string | null;
  /** Slug accepted by `subsector/report/:slug`. */
  readonly subSectorSlug: string | null;
  readonly industry: string | null;
  readonly marketCap: number | null;
  readonly lastClosePrice: number | null;
  readonly lastCloseDate: string | null;
  readonly indices: readonly string[];
};

/** Fetches the company overview, or returns `null` when Sectors has no such symbol. */
export async function fetchCompanyOverview(
  ticker: string,
  signal?: AbortSignal,
): Promise<CompanyOverview | null> {
  let report: z.infer<typeof CompanyOverviewSchema>;
  try {
    report = await sectorsFetch(`/company/report/${encodeURIComponent(ticker)}/`, {
      query: { sections: "overview" },
      signal,
      schema: CompanyOverviewSchema,
    });
  } catch (error) {
    if (error instanceof SectorsApiError && error.status === 404) return null;
    throw error;
  }

  const overview = report.overview;
  return {
    ticker: report.symbol.replace(/\.JK$/i, "").toUpperCase(),
    companyName: report.company_name,
    sector: overview?.sector ?? null,
    subSector: overview?.sub_sector ?? null,
    subSectorSlug: overview?.sub_sector ? subsectorSlug(overview.sub_sector) : null,
    industry: overview?.industry ?? null,
    marketCap: overview?.market_cap ?? null,
    lastClosePrice: overview?.last_close_price ?? null,
    lastCloseDate: overview?.latest_close_date ?? null,
    indices: overview?.indices ?? [],
  };
}

/** Converts a Sectors subsector display name into the slug its report endpoint expects. */
export function subsectorSlug(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
