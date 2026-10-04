import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { EvidenceItem } from "../agents/stock-investigator/schemas.ts";
import { sectorsFetch } from "../sectors/client.ts";
import { fetchCompanyOverview } from "../sectors/company.ts";
import { defineTool, type ToolExecutionResult } from "./contracts.ts";

const DateRangeInputSchema = z.object({
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
});

type DateRangeInput = z.infer<typeof DateRangeInputSchema>;

const DailyRecordSchema = z.looseObject({
  date: z.string(),
  close: z.number(),
  volume: z.number(),
});
const DailyResponseSchema = z.array(DailyRecordSchema);

const MarketRecordSchema = z.looseObject({
  date: z.string(),
  price: z.number(),
});
const MarketResponseSchema = z.array(MarketRecordSchema);

const CompanyResponseSchema = z.looseObject({});

const ForeignFlowResponseSchema = z.looseObject({
  data: z.array(
    z.looseObject({
      date: z.string(),
      net_foreign_inflow: z.number(),
    }),
  ),
});

const BrokerResponseSchema = z.looseObject({
  top_buyers: z.array(z.unknown()).optional(),
  top_sellers: z.array(z.unknown()).optional(),
});

const ResultsResponseSchema = z.looseObject({
  results: z.array(z.unknown()).default([]),
});

export const getPriceContext = defineTool({
  name: "get_price_context",
  description: "Collect recent daily close and volume data for the investigated ticker.",
  inputSchema: DateRangeInputSchema,
  execute: async (
    input: DateRangeInput,
    context,
  ): Promise<ToolExecutionResult<{ records: z.infer<typeof DailyResponseSchema> }>> => {
    const records = await sectorsFetch(`/daily/${context.ticker}/`, {
      query: dateQuery(input),
      signal: context.signal,
      schema: DailyResponseSchema,
    });
    return {
      value: { records },
      evidence: [
        createEvidence(
          "price_volume",
          `sectors:daily:${context.ticker}`,
          `Collected ${records.length} daily price-volume observations for ${context.ticker}.`,
          records,
        ),
      ],
      asOfDate: latestDate(records),
    };
  },
});

export const getMarketContext = defineTool({
  name: "get_market_context",
  description: "Collect IHSG daily prices for benchmark comparison.",
  inputSchema: DateRangeInputSchema,
  execute: async (
    input: DateRangeInput,
    context,
  ): Promise<ToolExecutionResult<{ records: Array<{ date: string; close: number }> }>> => {
    const rawRecords = await sectorsFetch("/index-daily/ihsg/", {
      query: dateQuery(input),
      signal: context.signal,
      schema: MarketResponseSchema,
    });
    const records = rawRecords.map(({ date, price }) => ({ date, close: price }));
    return {
      value: { records },
      evidence: [
        createEvidence(
          "market",
          "sectors:index-daily:ihsg",
          `Collected ${records.length} IHSG benchmark observations.`,
          rawRecords,
        ),
      ],
      asOfDate: latestDate(records),
    };
  },
});

export const getCompanyContext = defineTool({
  name: "get_company_context",
  description: "Collect the latest company overview and sector metadata.",
  inputSchema: z.object({}),
  execute: async (_input, context): Promise<ToolExecutionResult> => {
    const company = await fetchCompanyOverview(context.ticker, context.signal);
    if (!company) {
      return {
        value: { company: null },
        evidence: [
          createEvidence(
            "company",
            `sectors:company-report:${context.ticker}`,
            `Sectors has no company record for ${context.ticker}.`,
            null,
          ),
        ],
      };
    }

    return {
      value: { company },
      evidence: [
        createEvidence(
          "company",
          `sectors:company-report:${company.ticker}`,
          `Collected company overview for ${company.ticker} (${company.companyName}).`,
          company,
        ),
      ],
      asOfDate: company.lastCloseDate ?? undefined,
    };
  },
});

export const getSectorContext = defineTool({
  name: "get_sector_context",
  description:
    "Collect statistics and market-cap context for a company subsector. Omit sub_sector to use the investigated ticker's own subsector.",
  inputSchema: z.object({ sub_sector: z.string().trim().min(1).optional() }),
  execute: async ({ sub_sector }, context): Promise<ToolExecutionResult> => {
    const slug = sub_sector ?? (await resolveSubsectorSlug(context.ticker, context.signal));
    if (!slug) {
      return {
        value: { subSector: null, report: null },
        evidence: [
          createEvidence(
            "sector",
            `sectors:subsector-report:${context.ticker}`,
            `No subsector is available for ${context.ticker}; sector context was not collected.`,
            null,
          ),
        ],
      };
    }

    const report = await sectorsFetch(`/subsector/report/${encodeURIComponent(slug)}/`, {
      query: { sections: "statistics,market_cap" },
      signal: context.signal,
      schema: CompanyResponseSchema,
    });
    return {
      value: { subSector: slug, report },
      evidence: [
        createEvidence(
          "sector",
          `sectors:subsector-report:${slug}`,
          `Collected subsector statistics for ${slug}.`,
          report,
        ),
      ],
    };
  },
});

async function resolveSubsectorSlug(ticker: string, signal?: AbortSignal): Promise<string | null> {
  const company = await fetchCompanyOverview(ticker, signal);
  return company?.subSectorSlug ?? null;
}

export const getForeignFlow = defineTool({
  name: "get_foreign_flow",
  description: "Collect daily net foreign inflow for the investigated ticker.",
  inputSchema: DateRangeInputSchema,
  execute: async (input: DateRangeInput, context): Promise<ToolExecutionResult> => {
    const flow = await sectorsFetch(`/foreign-flow/${context.ticker}/`, {
      query: dateQuery(input),
      signal: context.signal,
      schema: ForeignFlowResponseSchema,
    });
    return {
      value: flow,
      evidence: [
        createEvidence(
          "foreign_flow",
          `sectors:foreign-flow:${context.ticker}`,
          `Collected ${flow.data.length} foreign-flow observations for ${context.ticker}.`,
          flow,
        ),
      ],
      asOfDate: latestDate(flow.data),
    };
  },
});

export const getBrokerActivity = defineTool({
  name: "get_broker_activity",
  description:
    "Collect top broker buyers and sellers for the investigated ticker. Use origin 'all' unless the question is specifically about foreign or domestic brokers.",
  inputSchema: z.object({
    origin: z.enum(["all", "foreign", "domestic"]).optional(),
  }),
  execute: async ({ origin = "all" }, context): Promise<ToolExecutionResult> => {
    const activity = await sectorsFetch(`/broker-summary/${context.ticker}/top/`, {
      query: { origin, cohort: "all", n_brokers: 5 },
      signal: context.signal,
      schema: BrokerResponseSchema,
    });
    return {
      value: activity,
      evidence: [
        createEvidence(
          "broker",
          `sectors:broker-summary:${context.ticker}`,
          `Collected ${origin} broker activity for ${context.ticker}.`,
          activity,
        ),
      ],
    };
  },
});

export const getCompanyNews = defineTool({
  name: "get_company_news",
  description: "Collect recent company news items for the investigated ticker.",
  inputSchema: DateRangeInputSchema,
  execute: async (input: DateRangeInput, context): Promise<ToolExecutionResult> => {
    const news = await sectorsFetch("/news/", {
      query: {
        extension: "idx",
        symbols: context.ticker,
        ...dateQuery(input),
        limit: 5,
        offset: 0,
      },
      signal: context.signal,
      schema: ResultsResponseSchema,
    });
    return {
      value: news,
      evidence: [
        createEvidence(
          "news",
          `sectors:news:${context.ticker}`,
          `Collected ${news.results.length} recent news items for ${context.ticker}.`,
          news,
        ),
      ],
    };
  },
});

export const getCompanyFilings = defineTool({
  name: "get_company_filings",
  description: "Collect recent company filing items for the investigated ticker.",
  inputSchema: DateRangeInputSchema,
  execute: async (input: DateRangeInput, context): Promise<ToolExecutionResult> => {
    const filings = await sectorsFetch("/filings/", {
      query: { symbol: context.ticker, ...dateQuery(input), limit: 5, offset: 0 },
      signal: context.signal,
      schema: ResultsResponseSchema,
    });
    return {
      value: filings,
      evidence: [
        createEvidence(
          "filing",
          `sectors:filings:${context.ticker}`,
          `Collected ${filings.results.length} recent filing items for ${context.ticker}.`,
          filings,
        ),
      ],
    };
  },
});

export const sectorsInvestigationTools = [
  getPriceContext,
  getMarketContext,
  getCompanyContext,
  getSectorContext,
  getForeignFlow,
  getBrokerActivity,
  getCompanyNews,
  getCompanyFilings,
] as const;

function dateQuery(input: DateRangeInput): Record<string, string | undefined> {
  const today = new Date().toISOString().slice(0, 10);
  const start = input.start && input.start > today ? today : input.start;
  const end = input.end && input.end > today ? today : input.end;
  return { start, end };
}

function latestDate(records: readonly { date: string }[]): string | undefined {
  return records.reduce<string | undefined>(
    (latest, record) => (latest === undefined || record.date > latest ? record.date : latest),
    undefined,
  );
}

function createEvidence(
  type: EvidenceItem["type"],
  source: string,
  summary: string,
  payload: unknown,
): EvidenceItem {
  return {
    id: randomUUID(),
    type,
    source,
    summary,
    payload,
    collectedAt: new Date().toISOString(),
  };
}
