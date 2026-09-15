/**
 * Model IDs are resolved once at import time and stay configurable through
 * environment variables. `src/server/index.ts` loads `.env` before this module
 * is imported.
 */
const DEFAULT_MODEL_ID = "openai/gpt-5.5";

/** Model used by the `planInvestigation` node. */
export const plannerModelId = process.env.AI_MODEL_PLANNER?.trim() || DEFAULT_MODEL_ID;

/** Model used by the `synthesize` node. */
export const synthesizerModelId = process.env.AI_MODEL_SYNTHESIZER?.trim() || DEFAULT_MODEL_ID;
