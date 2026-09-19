import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

const DEFAULT_MCP_URL = "https://sectors-mcp.supertype.ai/mcp";

/** Opens one server-side MCP session for a scoped conversation. */
export async function createSectorsMcpClient(): Promise<MCPClient> {
  const apiKey = process.env.SECTORS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SECTORS_API_KEY is not set. Copy .env.example to .env and configure it.");
  }

  return createMCPClient({
    transport: {
      type: "http",
      url: process.env.SECTORS_MCP_URL?.trim() || DEFAULT_MCP_URL,
      headers: { Authorization: apiKey },
    },
  });
}
