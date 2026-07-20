import { completeWithOpenAiCompatible } from "./openAiCompatible";
import { DEFAULT_REQUEST_TIMEOUT_MS, describeUpstreamError, type CompleteRequest, type CompleteResult } from "./types";

export const DEEPSEEK_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODELS_URL = "https://api.deepseek.com/models";

export async function completeWithDeepSeek(
  request: CompleteRequest,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<CompleteResult> {
  return completeWithOpenAiCompatible(request, { url: DEEPSEEK_COMPLETIONS_URL, timeoutMs });
}

export async function listDeepSeekModels(apiKey: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const response = await fetch(DEEPSEEK_MODELS_URL, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(describeUpstreamError(response.status, await response.text()));
  }

  const data = (await response.json()) as { data?: Array<{ id?: string }> };

  return (data.data ?? [])
    .filter((model): model is { id: string } => typeof model.id === "string")
    .map((model) => ({
      id: model.id,
      label: model.id,
      // DeepSeek offers a JSON mode but no schema enforcement.
      supportsStructuredOutputs: false,
    }));
}
