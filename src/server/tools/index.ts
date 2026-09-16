export {
  defineTool,
  type ToolContext,
  type ToolDefinition,
  type ToolExecutionResult,
} from "./contracts.ts";
import type { ToolDefinition } from "./contracts.ts";
import { sectorsInvestigationTools } from "./sectors.ts";

/** Registry consumed by the `investigateEvidence` node. */
export const stockInvestigationTools: readonly ToolDefinition[] = sectorsInvestigationTools;
