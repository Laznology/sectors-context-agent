import type { z } from "zod";

/** Runtime information passed to every tool call. */
export type ToolContext = {
  readonly investigationId?: string;
  readonly signal?: AbortSignal;
};

/**
 * A controlled semantic tool.
 *
 * The model may only pick a tool by name and fill a Zod-validated input object;
 * the request itself (URL, method, query) is always built in code. Tools are
 * also the only place allowed to call the Sectors client.
 */
export type ToolDefinition<TInput extends z.ZodType = z.ZodType, TOutput = unknown> = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TInput;
  readonly execute: (input: z.infer<TInput>, context: ToolContext) => Promise<TOutput>;
};

/** Identity helper that keeps tool definitions strongly typed. */
export function defineTool<TInput extends z.ZodType, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> {
  return tool;
}

/**
 * Registry consumed by the `investigateEvidence` node.
 *
 * Intentionally empty: Sectors-backed tools land in the next task.
 */
export const stockInvestigationTools: readonly ToolDefinition[] = [];
