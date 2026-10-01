import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { z } from "zod";

// `llm.ts` imports the gateway, which reads these at module load.
beforeAll(() => {
  process.env.AI_GATEWAY_URL = "https://gateway.test/v1";
  process.env.AI_GATEWAY_API_KEY = "test-key";
});

describe("withJsonContract", () => {
  it("keeps the original instruction lines", async () => {
    const { withJsonContract } = await import("./llm.ts");
    const prompt = withJsonContract(z.object({ a: z.string() }), ["line one", "line two"]);

    expect(prompt.startsWith("line one\nline two")).toBe(true);
  });

  it("spells out the JSON contract so gateways that drop response_format still comply", async () => {
    const { withJsonContract } = await import("./llm.ts");
    const prompt = withJsonContract(z.object({ a: z.string() }), ["plan the investigation"]);

    expect(prompt).toContain("ONLY a single valid JSON object");
    expect(prompt).toContain("Do not wrap it in markdown fences");
  });

  it("embeds the schema itself as JSON, not as prose", async () => {
    const { withJsonContract } = await import("./llm.ts");
    const { InvestigationPlanSchema } = await import("./schemas.ts");

    const prompt = withJsonContract(InvestigationPlanSchema, ["plan"]);
    const schemaLine = prompt.split("\n").at(-1) ?? "";
    const parsed = JSON.parse(schemaLine) as { properties?: Record<string, unknown> };

    expect(parsed.properties).toHaveProperty("steps");
    expect(parsed.properties).toHaveProperty("hypotheses");
  });
});

describe("output language", () => {
  it("instructs the model to answer in Bahasa Indonesia", async () => {
    const { OUTPUT_LANGUAGE_INSTRUCTION } = await import("./llm.ts");

    expect(OUTPUT_LANGUAGE_INSTRUCTION).toContain("Bahasa Indonesia");
  });

  it("is wired into both structured prompts", async () => {
    const source = readFileSync(new URL("./llm.ts", import.meta.url), "utf8");

    // One occurrence per generateObject call (planner and synthesizer).
    const uses = source.match(/OUTPUT_LANGUAGE_INSTRUCTION,/g) ?? [];
    expect(uses).toHaveLength(2);
  });

  it("is wired into the follow-up conversation system prompt", async () => {
    const source = readFileSync(new URL("./conversation.ts", import.meta.url), "utf8");

    expect(source).toContain("OUTPUT_LANGUAGE_INSTRUCTION,");
  });
});
