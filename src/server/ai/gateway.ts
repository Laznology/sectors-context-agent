import { gateway } from "@ai-sdk/gateway";
import { plannerModelId, synthesizerModelId } from "./models.ts";

/**
 * Server-only Vercel AI Gateway handles.
 *
 * The AI SDK is used for model interaction only; LangGraph owns orchestration,
 * and models are never called from React components. Credentials come from
 * `AI_GATEWAY_API_KEY` via the Gateway provider.
 */
export const plannerModel = gateway(plannerModelId);

export const synthesizerModel = gateway(synthesizerModelId);
