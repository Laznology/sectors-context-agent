import type { z } from "zod";
import type { EvidenceItem } from "../agents/stock-investigator/schemas.ts";

/** Runtime information passed to every tool call. */
export type ToolContext = {
  readonly ticker: string;
  readonly investigationId?: string;
  readonly signal?: AbortSignal;
};

export type ToolExecutionResult<TValue = unknown> = {
  readonly value: TValue;
  readonly evidence: readonly EvidenceItem[];
  readonly asOfDate?: string;
};

/** A semantic tool whose network boundary is fully controlled by application code. */
export type ToolDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends ToolExecutionResult = ToolExecutionResult,
> = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TInput;
  readonly execute: (input: z.infer<TInput>, context: ToolContext) => Promise<TOutput>;
};

/** Identity helper that keeps tool definitions strongly typed. */
export function defineTool<TInput extends z.ZodType, TOutput extends ToolExecutionResult>(
  tool: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> {
  return tool;
}
