import { generateText } from "ai";
import "dotenv/config";
import { z } from "zod";
import { synthesizerModel } from "../ai/gateway.ts";
import { createSectorsMcpClient } from "../sectors/mcp.ts";

/**
 * Real smoke test for the configured OpenAI-compatible gateway and the Sectors
 * MCP endpoint. Usage:
 *   pnpm exec tsx src/server/scripts/smoke.ts
 *   pnpm exec tsx src/server/scripts/smoke.ts <toolName> '<jsonArgs>'
 */
const [toolName, toolArguments] = process.argv.slice(2);
let failed = false;

/** CLI tool arguments are arbitrary JSON objects; validate before handing them to MCP. */
const ToolArgumentsSchema = z.record(z.string(), z.unknown());

function parseToolArguments(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  return ToolArgumentsSchema.parse(value);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  try {
    const response = await generateText({
      model: synthesizerModel,
      prompt: "Reply with exactly: provider-ok",
    });
    console.log(`provider ok (${Date.now() - startedAt}ms): ${response.text.trim()}`);
  } catch (error) {
    failed = true;
    console.log(`provider failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const mcp = await createSectorsMcpClient();
    try {
      const { tools } = await mcp.listTools();
      console.log(`mcp ok (${tools.length} tools):`);
      for (const tool of tools) console.log(`- ${tool.name}`);

      if (toolName) {
        const args = toolArguments ? parseToolArguments(toolArguments) : {};
        const result = await mcp.callTool({ name: toolName, arguments: args });
        console.log(`mcp call ${toolName}:`);
        console.log(JSON.stringify(result, null, 2).slice(0, 2_000));
      }
    } finally {
      await mcp.close();
    }
  } catch (error) {
    failed = true;
    console.log(`mcp failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failed) process.exitCode = 1;
}

await main();
