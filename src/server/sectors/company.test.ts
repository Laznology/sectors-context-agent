import { describe, expect, it } from "vite-plus/test";
import { fetchCompanyOverview, subsectorSlug } from "./company.ts";

describe("subsectorSlug", () => {
  it("converts Sectors display names into the slugs its report endpoint expects", () => {
    expect(subsectorSlug("Food & Beverage")).toBe("food-beverage");
    expect(subsectorSlug("Basic Materials")).toBe("basic-materials");
    expect(subsectorSlug("Software & IT Services")).toBe("software-it-services");
    expect(subsectorSlug("Banks")).toBe("banks");
  });
});

describe("fetchCompanyOverview", () => {
  it("extracts the company name, sector, and subsector slug", async () => {
    const previousKey = process.env.SECTORS_API_KEY;
    process.env.SECTORS_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          symbol: "ANTM.JK",
          company_name: "Aneka Tambang Tbk.",
          overview: {
            sector: "Basic Materials",
            sub_sector: "Basic Materials",
            industry: "Metals & Minerals",
            market_cap: 80262754181500,
            last_close_price: 3340,
            latest_close_date: "2026-09-18",
            indices: ["LQ45"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const company = await fetchCompanyOverview("ANTM");

      expect(company).toMatchObject({
        ticker: "ANTM",
        companyName: "Aneka Tambang Tbk.",
        sector: "Basic Materials",
        subSectorSlug: "basic-materials",
        industry: "Metals & Minerals",
        lastClosePrice: 3340,
        lastCloseDate: "2026-09-18",
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.SECTORS_API_KEY;
      else process.env.SECTORS_API_KEY = previousKey;
    }
  });

  it("returns null for a symbol Sectors does not know", async () => {
    const previousKey = process.env.SECTORS_API_KEY;
    process.env.SECTORS_API_KEY = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Given stock symbol does not exist." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      expect(await fetchCompanyOverview("ZZZZ")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.SECTORS_API_KEY;
      else process.env.SECTORS_API_KEY = previousKey;
    }
  });
});
