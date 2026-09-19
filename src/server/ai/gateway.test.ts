import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const environmentKeys = ["AI_GATEWAY_URL", "AI_GATEWAY_API_KEY"] as const;
const savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of environmentKeys) {
    const value = savedEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

async function importGateway() {
  vi.resetModules();
  return import("./gateway.ts");
}

describe("AI gateway provider", () => {
  it("rejects a missing AI_GATEWAY_URL", async () => {
    delete process.env.AI_GATEWAY_URL;
    process.env.AI_GATEWAY_API_KEY = "test-key";

    await expect(importGateway()).rejects.toThrow("AI_GATEWAY_URL is not set");
  });

  it("rejects a missing AI_GATEWAY_API_KEY", async () => {
    process.env.AI_GATEWAY_URL = "https://gateway.test/v1";
    delete process.env.AI_GATEWAY_API_KEY;

    await expect(importGateway()).rejects.toThrow("AI_GATEWAY_API_KEY is not set");
  });

  it("binds planner and synthesizer models to the configured gateway", async () => {
    process.env.AI_GATEWAY_URL = "https://gateway.test/v1";
    process.env.AI_GATEWAY_API_KEY = "test-key";

    vi.resetModules();
    const [gateway, models] = await Promise.all([import("./gateway.ts"), import("./models.ts")]);

    expect(gateway.plannerModel.provider).toBe("ai-gateway.chat");
    expect(gateway.plannerModel.modelId).toBe(models.plannerModelId);
    expect(gateway.synthesizerModel.provider).toBe("ai-gateway.chat");
    expect(gateway.synthesizerModel.modelId).toBe(models.synthesizerModelId);
  });
});
