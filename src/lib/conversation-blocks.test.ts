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

describe("splitBlocksFromAnswer robustness", () => {
  it("keeps trailing prose out of the blocks line", () => {
    const raw =
      'Answer.\n{"blocks":[{"type":"metric","label":"Close","value":"3,140"}]}\nHope this helps.';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).not.toContain("blocks");
    expect(prose).toContain("Answer.");
    expect(prose).toContain("Hope this helps.");
    expect(blocks).toHaveLength(1);
  });

  it("does not truncate on an earlier mention of blocks in prose", () => {
    const raw =
      'The blocks field is not used here.\nMore prose.\n{"blocks":[{"type":"metric","label":"Close","value":"3,140"}]}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toContain("The blocks field is not used here.");
    expect(prose).toContain("More prose.");
    expect(blocks).toHaveLength(1);
  });

  it("treats an unrelated JSON line as prose", () => {
    const raw = 'Answer.\n{"other":1}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toContain("Answer.");
    expect(blocks).toEqual([]);
  });

  it("splits a contract glued onto the last sentence with no newline", () => {
    const raw =
      'Ingin saya dalami lebih lanjut, misalnya data broker?{"blocks":[{"type":"metric","label":"Close","value":"6.100"}]}';
    const { prose, blocks } = splitBlocksFromAnswer(raw);

    expect(prose).toBe("Ingin saya dalami lebih lanjut, misalnya data broker?");
    expect(prose).not.toContain("blocks");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("metric");
  });
});
