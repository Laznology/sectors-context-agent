import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn(async () => ({ close: vi.fn(async () => {}) })),
}));

import { createMCPClient } from "@ai-sdk/mcp";
import { createSectorsMcpClient } from "./mcp.ts";

const environmentKeys = ["SECTORS_API_KEY", "SECTORS_MCP_URL"] as const;
const savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.mocked(createMCPClient).mockClear();
});

afterEach(() => {
  for (const key of environmentKeys) {
    const value = savedEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Sectors MCP client", () => {
  it("rejects a missing or blank SECTORS_API_KEY before connecting", async () => {
    delete process.env.SECTORS_API_KEY;
    await expect(createSectorsMcpClient()).rejects.toThrow("SECTORS_API_KEY is not set");

    process.env.SECTORS_API_KEY = "   ";
    await expect(createSectorsMcpClient()).rejects.toThrow("SECTORS_API_KEY is not set");

    expect(createMCPClient).not.toHaveBeenCalled();
  });

  it("opens an HTTP MCP session against the default Sectors endpoint", async () => {
    process.env.SECTORS_API_KEY = "test-key";
    delete process.env.SECTORS_MCP_URL;

    const client = await createSectorsMcpClient();

    expect(createMCPClient).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://sectors-mcp.supertype.ai/mcp",
        headers: { Authorization: "test-key" },
      },
    });
    expect(client.close).toBeTypeOf("function");
  });

  it("honors the SECTORS_MCP_URL override", async () => {
    process.env.SECTORS_API_KEY = "test-key";
    process.env.SECTORS_MCP_URL = "https://mcp.test/v1";

    await createSectorsMcpClient();

    expect(createMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.objectContaining({ url: "https://mcp.test/v1" }),
      }),
    );
  });
});
