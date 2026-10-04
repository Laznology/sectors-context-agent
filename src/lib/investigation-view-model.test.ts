import { describe, expect, it } from "vite-plus/test";
import { toInvestigationData, toolLabel } from "./investigation-view-model.ts";

describe("toInvestigationData", () => {
  it("maps the API payload into the report view model", () => {
    const result = toInvestigationData({
      id: "inv-1",
      ticker: "AAPL",
      question: "Why did AAPL move?",
      status: "completed",
      statusLabel: "attention",
      driver: "MARKET_DRIVEN",
      confidence: 0.82,
      confidenceReason: "Broad index move",
      whatChanged: "Up 3%",
      whyItMatters: "Sector wide",
      explanation: "Driven by the market",
      whatToMonitorJson: ["Volume", "Fed meeting"],
      changesSincePrevious: "Confidence rose",
      evidence: [
        { type: "price_volume", summary: "Volume spike" },
        { type: "unknown_type", summary: "ignored" },
      ],
      toolCalls: [
        { toolName: "get_price_context", reason: "baseline", status: "succeeded", durationMs: 12 },
        { toolName: "get_market_context", status: "failed" },
      ],
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.statusLabel).toBe("ATTENTION");
    expect(result.likelyDriver).toBe("MARKET_DRIVEN");
    expect(result.confidence).toBe("HIGH");
    expect(result.evidence).toEqual({ price_volume: "Volume spike" });
    expect(result.investigationPath).toEqual([
      {
        toolName: "get_price_context",
        label: "Price Context",
        reason: "baseline",
        status: "success",
        findings: ["Volume spike"],
        durationMs: 12,
      },
      {
        toolName: "get_market_context",
        label: "Market Context",
        reason: "",
        status: "failure",
        findings: [],
        durationMs: 0,
      },
    ]);
  });

  it("attributes company evidence to the Company Context step", () => {
    const result = toInvestigationData({
      id: "inv-company",
      status: "completed",
      evidence: [{ type: "company", summary: "Company overview collected for ANTM." }],
      toolCalls: [{ toolName: "get_company_context", status: "succeeded", durationMs: 5 }],
    });

    expect(result.investigationPath[0].label).toBe("Company Context");
    expect(result.investigationPath[0].findings).toEqual(["Company overview collected for ANTM."]);
  });

  it("builds ordered evidence cards and prefers the model finding", () => {
    const result = toInvestigationData({
      id: "inv-1b",
      status: "completed",
      evidence: [{ type: "foreign_flow", summary: "raw tool summary" }],
      evidenceSummaryJson: [
        { label: "Foreign Flow", finding: "Inflow strengthened", importance: "high" },
      ],
    });

    const foreignFlow = result.evidenceCards.find((card) => card.type === "foreign_flow");
    expect(foreignFlow).toEqual({
      type: "foreign_flow",
      label: "Foreign Flow",
      finding: "Inflow strengthened",
      importance: "high",
    });

    const filing = result.evidenceCards.find((card) => card.type === "filing");
    expect(filing).toEqual({
      type: "filing",
      label: "Filings",
      finding: null,
      importance: null,
    });
  });

  it("matches model findings written in Bahasa Indonesia", () => {
    const result = toInvestigationData({
      id: "inv-1c",
      status: "completed",
      evidenceSummaryJson: [
        { label: "Aliran Asing", finding: "Inflow menguat", importance: "medium" },
        { label: "Volume", finding: "Volume naik", importance: "high" },
      ],
    });

    expect(result.evidenceCards.find((card) => card.type === "foreign_flow")?.finding).toBe(
      "Inflow menguat",
    );
    expect(result.evidenceCards.find((card) => card.type === "price_volume")?.finding).toBe(
      "Volume naik",
    );
  });

  it("defaults missing fields and grades confidence bands", () => {
    const result = toInvestigationData({ id: "inv-2", status: "pending" });

    expect(result.likelyDriver).toBe("UNCLEAR");
    expect(result.statusLabel).toBeNull();
    expect(result.confidence).toBe("LOW");
    expect(result.status).toBe("IN_PROGRESS");
    expect(result.evidence).toEqual({});
    expect(result.whatToMonitor).toEqual([]);
    expect(result.conversation).toEqual([]);
    expect(result.investigationPath).toEqual([]);
  });

  it("keeps the persisted follow-up conversation in order", () => {
    const conversations = [
      {
        id: "c1",
        role: "user" as const,
        content: "Foreign flow?",
        createdAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "c2",
        role: "assistant" as const,
        content: "Masih net buy.",
        createdAt: "2026-10-01T00:00:05Z",
      },
    ];
    const result = toInvestigationData({ id: "inv-3", status: "completed", conversations });

    expect(result.conversation).toEqual(conversations);
  });
});

describe("toolLabel", () => {
  it("maps known tools to human-readable labels", () => {
    expect(toolLabel("get_foreign_flow")).toBe("Foreign Flow");
    expect(toolLabel("mcp:get_broker_activity")).toBe("Broker Activity");
  });

  it("title-cases unknown tool names instead of leaking the identifier", () => {
    expect(toolLabel("get_custom_thing")).toBe("Custom Thing");
  });
});

describe("toInvestigationData timeline", () => {
  it("derives the ticker's timeline and marks the shown run current", () => {
    const result = toInvestigationData({
      id: "new",
      ticker: "ANTM",
      status: "completed",
      runs: [
        {
          id: "old",
          ticker: "ANTM",
          status: "completed",
          driver: "MARKET_DRIVEN",
          confidence: 0.5,
          whatChanged: "Moved with the market.",
          changesSincePrevious: null,
          createdAt: "2026-09-29T01:00:00Z",
          completedAt: "2026-09-29T01:05:00Z",
        },
        {
          id: "new",
          ticker: "ANTM",
          status: "completed",
          driver: "FLOW_DRIVEN",
          confidence: 0.8,
          whatChanged: "Foreign inflow strengthened.",
          changesSincePrevious: "Foreign inflow continued.",
          createdAt: "2026-10-02T01:00:00Z",
          completedAt: "2026-10-02T01:05:00Z",
        },
      ],
    });

    expect(result.timeline.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(result.timeline[0].isCurrent).toBe(true);
    expect(result.timeline[0].delta).toBe("Foreign inflow continued.");
    expect(result.timeline[1].delta).toBeNull();
  });

  it("yields an empty timeline when the payload carries no runs", () => {
    expect(toInvestigationData({ id: "solo", status: "completed" }).timeline).toEqual([]);
  });
});
