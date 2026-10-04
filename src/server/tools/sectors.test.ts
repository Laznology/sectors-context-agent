import { describe, expect, it, vi } from "vite-plus/test";
import { getBrokerActivity, getPriceContext, sectorsInvestigationTools } from "./sectors.ts";

/**
 * Runs one tool against a stubbed `fetch` and returns every request URL it
 * built, in order. Sectors rejects unknown query values with a 400, so
 * asserting the exact URLs is what keeps these wrappers honest.
 */
async function captureRequestUrls(
  execute: () => Promise<unknown>,
  payload: unknown = {},
): Promise<string[]> {
  const previousKey = process.env.SECTORS_API_KEY;
  const requestUrls: string[] = [];
  process.env.SECTORS_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      requestUrls.push(String(input));
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );

  try {
    await execute();
    return requestUrls;
  } finally {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.SECTORS_API_KEY;
    else process.env.SECTORS_API_KEY = previousKey;
  }
}

describe("Sectors semantic tools", () => {
  it("builds the fixed daily endpoint and returns traceable evidence", async () => {
    const previousKey = process.env.SECTORS_API_KEY;
    let requestUrl = "";
    const fetchMock = vi.fn(async (input: unknown) => {
      requestUrl = String(input);
      return new Response(
        JSON.stringify([
          { date: "2026-09-15", close: 100, volume: 100 },
          { date: "2026-09-16", close: 110, volume: 180 },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    process.env.SECTORS_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await getPriceContext.execute(
        { start: "2026-09-15", end: "2026-09-16" },
        { ticker: "ANTM" },
      );

      expect(requestUrl).toContain("/v2/daily/ANTM/");
      expect(requestUrl).toContain("start=2026-09-15");
      expect(requestUrl).toContain("end=2026-09-16");
      expect(result.value.records).toHaveLength(2);
      expect(result.asOfDate).toBe("2026-09-16");
      expect(result.evidence[0]?.type).toBe("price_volume");
      expect(result.evidence[0]?.source).toBe("sectors:daily:ANTM");
    } finally {
      vi.unstubAllGlobals();
      if (previousKey === undefined) delete process.env.SECTORS_API_KEY;
      else process.env.SECTORS_API_KEY = previousKey;
    }
  });

  it("clamps a planner-supplied future date range to today", async () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const [requestUrl] = await captureRequestUrls(
      () => getPriceContext.execute({ start: "2026-09-25", end: future }, { ticker: "ANTM" }),
      [],
    );

    expect(requestUrl).toContain(`end=${today}`);
    expect(requestUrl).not.toContain(`end=${future}`);
  });

  it("sends broker-summary an origin Sectors accepts", async () => {
    const [requestUrl] = await captureRequestUrls(() =>
      getBrokerActivity.execute({}, { ticker: "ANTM" }),
    );

    expect(requestUrl).toContain("/v2/broker-summary/ANTM/top/");
    expect(requestUrl).toContain("origin=all");
    expect(requestUrl).not.toContain("origin=local");
    expect(requestUrl).toContain("cohort=all");
    expect(requestUrl).toContain("n_brokers=5");
  });

  it("accepts only the origin values Sectors documents", () => {
    const broker = sectorsInvestigationTools.find((tool) => tool.name === "get_broker_activity");
    if (!broker) throw new Error("get_broker_activity is not registered");

    expect(broker.inputSchema.safeParse({ origin: "domestic" }).success).toBe(true);
    expect(broker.inputSchema.safeParse({ origin: "foreign" }).success).toBe(true);
    expect(broker.inputSchema.safeParse({ origin: "local" }).success).toBe(false);
  });

  it("lets get_sector_context run without the planner naming a subsector", async () => {
    const requestUrls = await captureRequestUrls(
      () => {
        const sector = sectorsInvestigationTools.find((tool) => tool.name === "get_sector_context");
        if (!sector) throw new Error("get_sector_context is not registered");
        return sector.execute({}, { ticker: "ANTM" });
      },
      {
        symbol: "ANTM.JK",
        company_name: "Aneka Tambang Tbk.",
        overview: { sector: "Basic Materials", sub_sector: "Basic Materials" },
      },
    );

    expect(requestUrls[0]).toContain("/v2/company/report/ANTM/");
    expect(requestUrls[1]).toContain("/v2/subsector/report/basic-materials/");
    expect(requestUrls[1]).not.toContain("Basic%20Materials");
  });
});
