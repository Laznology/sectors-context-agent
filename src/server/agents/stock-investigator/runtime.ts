import { randomUUID } from "node:crypto";
import { z } from "zod";
import { calculateSignals, signalThresholdsFromEnv } from "../../analysis/signals.ts";
import type { ToolContext, ToolDefinition } from "../../tools/index.ts";
import { sectorsInvestigationTools } from "../../tools/sectors.ts";
import {
  buildStockInvestigatorGraph,
  type BaselineCollection,
  type StockInvestigatorDependencies,
} from "./graph.ts";
import { planWithModel, synthesizeWithModel } from "./llm.ts";
import {
  BaselineContextSchema,
  ToolCallRecordSchema,
  type BaselineContext,
  type ToolCallRecord,
} from "./schemas.ts";
const PriceValueSchema = z.object({
  records: z.array(z.object({ date: z.string(), close: z.number(), volume: z.number() })),
});
const MarketValueSchema = z.object({
  records: z.array(z.object({ date: z.string(), close: z.number() })),
});
const CompanyValueSchema = z.object({
  ticker: z.string().optional(),
  companyName: z.string().optional(),
  sector: z.string().nullable().optional(),
  subSector: z.string().nullable().optional(),
  subSectorSlug: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  lastClosePrice: z.number().nullable().optional(),
  lastCloseDate: z.string().nullable().optional(),
  indices: z.array(z.string()).optional(),
});

export function createProductionDependencies(): StockInvestigatorDependencies {
  const thresholds = signalThresholdsFromEnv();
  return {
    collectBaseline: collectBaselineFromSectors,
    calculateSignals: (baseline) => calculateSignals(baseline, thresholds),
    planner: (input) =>
      planWithModel(
        input,
        sectorsInvestigationTools.filter((tool) => input.route.allowedTools.includes(tool.name)),
      ),
    tools: sectorsInvestigationTools,
    synthesizer: (input) => synthesizeWithModel(input),
  };
}

export function createProductionGraph() {
  return buildStockInvestigatorGraph(createProductionDependencies());
}

async function collectBaselineFromSectors(
  _input: { readonly ticker: string; readonly question?: string },
  context: ToolContext,
): Promise<BaselineCollection> {
  const dateRange = recentDateRange();
  const specs = [
    { toolName: "get_price_context", input: dateRange },
    { toolName: "get_market_context", input: dateRange },
    { toolName: "get_company_context", input: {} },
  ] as const;
  const toolsByName: Record<string, ToolDefinition> = Object.fromEntries(
    sectorsInvestigationTools.map((tool) => [tool.name, tool]),
  );
  const outcomes = await Promise.all(
    specs.map(async (spec) => {
      const startedAt = new Date();
      const tool = toolsByName[spec.toolName];
      if (!tool) {
        return {
          spec,
          execution: undefined,
          toolCall: baselineToolCall(
            spec,
            startedAt,
            "failed",
            "TOOL_NOT_ALLOWED",
            "Baseline tool is not registered",
          ),
        };
      }
      const parsedInput = tool.inputSchema.safeParse(spec.input);
      if (!parsedInput.success) {
        return {
          spec,
          execution: undefined,
          toolCall: baselineToolCall(
            spec,
            startedAt,
            "failed",
            "INVALID_TOOL_INPUT",
            parsedInput.error.issues.map((issue) => issue.message).join("; "),
          ),
        };
      }
      try {
        const execution = await tool.execute(parsedInput.data, context);
        return {
          spec,
          execution,
          toolCall: baselineToolCall(
            spec,
            startedAt,
            "succeeded",
            undefined,
            undefined,
            execution.value,
          ),
        };
      } catch (error) {
        return {
          spec,
          execution: undefined,
          toolCall: baselineToolCall(
            spec,
            startedAt,
            "failed",
            "TOOL_EXECUTION_FAILED",
            errorMessage(error),
          ),
        };
      }
    }),
  );

  const priceValue = outcomes.find((outcome) => outcome.spec.toolName === "get_price_context")
    ?.execution?.value;
  const marketValue = outcomes.find((outcome) => outcome.spec.toolName === "get_market_context")
    ?.execution?.value;
  const companyValue = outcomes.find((outcome) => outcome.spec.toolName === "get_company_context")
    ?.execution?.value;
  const price = PriceValueSchema.safeParse(priceValue);
  const market = MarketValueSchema.safeParse(marketValue);
  const company = CompanyValueSchema.safeParse(
    (companyValue as { company?: unknown } | undefined)?.company,
  );
  const baseline: BaselineContext = BaselineContextSchema.parse({
    price: price.success ? price.data.records : [],
    market: market.success ? market.data.records : [],
    company: company.success ? company.data : undefined,
  });
  const evidence = outcomes.flatMap((outcome) => outcome.execution?.evidence ?? []);
  return {
    baseline,
    evidence,
    toolCalls: outcomes.map((outcome) => outcome.toolCall),
  };
}

function recentDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  // PRD §9 asks for roughly 20–30 trading days. 45 calendar days covers 30
  // trading days plus IDX holidays, and leaves slack for the 20-day volume window.
  start.setUTCDate(start.getUTCDate() - 45);
  return { start: toDate(start), end: toDate(end) };
}

function toDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function baselineToolCall(
  spec: { readonly toolName: string },
  startedAt: Date,
  status: ToolCallRecord["status"],
  errorCode?: string,
  errorMessageValue?: string,
  output?: unknown,
): ToolCallRecord {
  const finishedAt = new Date();
  return ToolCallRecordSchema.parse({
    id: randomUUID(),
    toolName: spec.toolName,
    status,
    reason: "Collect baseline context",
    input: undefined,
    output,
    errorCode,
    errorMessage: errorMessageValue,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
