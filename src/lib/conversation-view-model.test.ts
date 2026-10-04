import { describe, expect, it } from "vite-plus/test";
import { parseUiBlocks, toMessageParts } from "./conversation-view-model.ts";

describe("parseUiBlocks", () => {
  it("parses each supported block type", () => {
    const blocks = parseUiBlocks([
      { type: "metric", label: "Close", value: "3,140", change: "+0.64%", direction: "up" },
      { type: "comparison", title: "Peers", rows: [{ label: "ANTM", value: "+4.1%" }] },
      { type: "series", title: "Close", points: [{ date: "2026-10-01", value: 3120 }] },
      { type: "driver", driver: "FLOW_DRIVEN", confidence: "HIGH" },
      { type: "sources", items: [{ label: "Sectors daily" }] },
    ]);

    expect(blocks.map((block) => block.type)).toEqual([
      "metric",
      "comparison",
      "series",
      "driver",
      "sources",
    ]);
  });

  it("drops an unknown block type and keeps the rest", () => {
    const blocks = parseUiBlocks([
      { type: "metric", label: "Close", value: "3,140" },
      { type: "hologram", label: "nope" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("metric");
  });

  it("drops a metric with a missing label", () => {
    expect(parseUiBlocks([{ type: "metric", value: "3,140" }])).toEqual([]);
  });

  it("drops a series point with a non-numeric value", () => {
    expect(
      parseUiBlocks([
        { type: "series", title: "Close", points: [{ date: "2026-10-01", value: "x" }] },
      ]),
    ).toEqual([]);
  });

  it("rejects a driver outside the shared vocabulary", () => {
    expect(
      parseUiBlocks([{ type: "driver", driver: "SENTIMENT_DRIVEN", confidence: "HIGH" }]),
    ).toEqual([]);
  });

  it("rejects a confidence outside the shared bands", () => {
    expect(
      parseUiBlocks([{ type: "driver", driver: "FLOW_DRIVEN", confidence: "CERTAIN" }]),
    ).toEqual([]);
  });

  it("ignores a payload that is not an array", () => {
    expect(parseUiBlocks({ type: "metric" })).toEqual([]);
    expect(parseUiBlocks(null)).toEqual([]);
    expect(parseUiBlocks(undefined)).toEqual([]);
  });
});

describe("toMessageParts", () => {
  it("yields a single text part when a message has no blocks", () => {
    const parts = toMessageParts({ content: "Foreign inflow strengthened." });

    expect(parts).toEqual([{ kind: "text", text: "Foreign inflow strengthened." }]);
  });

  it("yields the text part followed by its blocks in order", () => {
    const parts = toMessageParts({
      content: "Here is the close.",
      uiBlocks: [
        { type: "metric", label: "Close", value: "3,140" },
        { type: "driver", driver: "FLOW_DRIVEN", confidence: "HIGH" },
      ],
    });

    expect(parts.map((part) => part.kind)).toEqual(["text", "block", "block"]);
  });

  it("drops an unknown block but keeps the text and the valid blocks", () => {
    const parts = toMessageParts({
      content: "Answer.",
      uiBlocks: [{ type: "hologram" }, { type: "metric", label: "Close", value: "3,140" }],
    });

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ kind: "text", text: "Answer." });
  });

  it("omits an empty text part rather than rendering blank", () => {
    const parts = toMessageParts({
      content: "   ",
      uiBlocks: [{ type: "metric", label: "Close", value: "3,140" }],
    });

    expect(parts).toEqual([
      { kind: "block", block: { type: "metric", label: "Close", value: "3,140" } },
    ]);
  });

  it("returns no parts for an empty message with no blocks", () => {
    expect(toMessageParts({ content: "" })).toEqual([]);
  });
});
