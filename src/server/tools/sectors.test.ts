import { describe, expect, it, vi } from "vite-plus/test";
import { getPriceContext } from "./sectors.ts";

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
});
