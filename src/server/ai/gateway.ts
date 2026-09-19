import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { plannerModelId, synthesizerModelId } from "./models.ts";

const provider = createOpenAICompatible({
  name: "ai-gateway",
  baseURL: requiredEnvironment("AI_GATEWAY_URL"),
  apiKey: requiredEnvironment("AI_GATEWAY_API_KEY"),
  supportsStructuredOutputs: true,
  // The OmniRoute gateway streams whenever `stream` is absent, which breaks the
  // non-streaming JSON path. Send an explicit value: false for generate calls,
  // while streaming calls keep their own `stream: true`.
  transformRequestBody: (args) => ({ stream: false, ...args }),
});

export const plannerModel = provider(plannerModelId);

export const synthesizerModel = provider(synthesizerModelId);

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
