import { completeWithOpenAiCompatible } from "./openAiCompatible";
import { DEFAULT_REQUEST_TIMEOUT_MS, describeUpstreamError, type CompleteRequest, type CompleteResult } from "./types";

export const OPENROUTER_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export async function completeWithOpenRouter(
  request: CompleteRequest,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<CompleteResult> {
  return completeWithOpenAiCompatible(request, { url: OPENROUTER_COMPLETIONS_URL, timeoutMs });
}

// OpenRouter publishes which parameters each model accepts; that is how we know whether a
// model can be schema-constrained or has to fall back to prompting.
export function supportsStructuredOutputs(supportedParameters: unknown): boolean {
  if (!Array.isArray(supportedParameters)) return false;
  return supportedParameters.includes("structured_outputs") || supportedParameters.includes("response_format");
}

export async function listOpenRouterModels(apiKey: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(describeUpstreamError(response.status, await response.text()));
  }

  const data = (await response.json()) as {
    data?: Array<{ id?: string; name?: string; supported_parameters?: unknown }>;
  };

  return (data.data ?? [])
    .filter((model): model is { id: string; name?: string; supported_parameters?: unknown } => typeof model.id === "string")
    .map((model) => ({
      id: model.id,
      label: model.name ?? model.id,
      supportsStructuredOutputs: supportsStructuredOutputs(model.supported_parameters),
    }));
}
