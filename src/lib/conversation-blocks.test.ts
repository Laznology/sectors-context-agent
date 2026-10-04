import { describe, expect, it } from "vite-plus/test";
import { splitBlocksFromAnswer } from "@/lib/conversation-view-model.ts";

describe("splitBlocksFromAnswer", () => {
  it("separates the trailing block contract from the prose", () => {
    const raw =
      'Foreign inflow strengthened.\n{"blocks":[{"type":"metric","label":"Close","value":"3,140"}]}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toBe("Foreign inflow strengthened.");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("metric");
  });

  it("returns the whole answer as prose when there is no contract", () => {
    const { prose, blocks } = splitBlocksFromAnswer("Just an answer.");

    expect(prose).toBe("Just an answer.");
    expect(blocks).toEqual([]);
  });

  it("drops an unknown block but keeps the prose", () => {
    const raw = 'Answer.\n{"blocks":[{"type":"hologram"}]}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toBe("Answer.");
    expect(blocks).toEqual([]);
  });

  it("keeps the prose when the contract is malformed JSON", () => {
    const raw = 'Answer.\n{"blocks":[{"type":"metric",]}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toContain("Answer.");
    expect(blocks).toEqual([]);
  });
});
