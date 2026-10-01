import { describe, expect, it } from "vite-plus/test";
import { toInvestigationData } from "./investigation-view-model.ts";

describe("toInvestigationData", () => {
  it("maps the API payload into the report view model", () => {
    const result = toInvestigationData({
      id: "inv-1",
      ticker: "AAPL",
      question: "Why did AAPL move?",
      status: "completed",
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
    expect(result.likelyDriver).toBe("MARKET_DRIVEN");
    expect(result.confidence).toBe("HIGH");
    expect(result.evidence).toEqual({ price_volume: "Volume spike" });
    expect(result.investigationPath).toEqual([
      { toolName: "get_price_context", reason: "baseline", status: "success", durationMs: 12 },
      { toolName: "get_market_context", reason: "", status: "failure", durationMs: 0 },
    ]);
  });

  it("defaults missing fields and grades confidence bands", () => {
    const result = toInvestigationData({ id: "inv-2", status: "pending" });

    expect(result.likelyDriver).toBe("UNCLEAR");
    expect(result.confidence).toBe("LOW");
    expect(result.status).toBe("IN_PROGRESS");
    expect(result.evidence).toEqual({});
    expect(result.whatToMonitor).toEqual([]);
    expect(result.conversation).toEqual([]);
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
