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
