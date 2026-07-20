import { DEFAULT_REQUEST_TIMEOUT_MS, describeUpstreamError, type CompleteRequest, type CompleteResult } from "./types";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";

// Kept byte-compatible with what agentClient/commentReplyClient/claudeInsightsClient sent
// before the model layer existed, so switching them over is a no-op until settings change.
export function buildAnthropicBody(request: CompleteRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.system,
    messages: request.messages,
  };

  if (request.mechanism === "native_schema" && request.schema) {
    body.output_config = { format: { type: "json_schema", schema: request.schema } };
  }

  return body;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function parseAnthropicResponse(data: AnthropicResponse, maxTokens: number): CompleteResult {
  const outputTokens = data.usage?.output_tokens;
  const textBlock = data.content?.find((block) => block.type === "text");

  return {
    text: textBlock?.text ?? "",
    // A schema-constrained decoder can force-close a truncated answer into syntactically
    // valid JSON while still reporting a normal stop reason, so budget exhaustion has to be
    // detected from the token count rather than from stop_reason.
    truncated: typeof outputTokens === "number" && outputTokens >= maxTokens - 16,
    inputTokens: data.usage?.input_tokens,
    outputTokens,
  };
}

export async function completeWithAnthropic(
  request: CompleteRequest,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<CompleteResult> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": request.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(buildAnthropicBody(request)),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(describeUpstreamError(response.status, await response.text()));
  }

  return parseAnthropicResponse(await response.json(), request.maxTokens);
}

export async function listAnthropicModels(apiKey: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const response = await fetch(ANTHROPIC_MODELS_URL, {
    headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(describeUpstreamError(response.status, await response.text()));
  }

  const data = (await response.json()) as { data?: Array<{ id?: string; display_name?: string }> };

  return (data.data ?? [])
    .filter((model): model is { id: string; display_name?: string } => typeof model.id === "string")
    .map((model) => ({
      id: model.id,
      label: model.display_name ?? model.id,
      // Every current Anthropic model supports schema-constrained output.
      supportsStructuredOutputs: true,
    }));
}
