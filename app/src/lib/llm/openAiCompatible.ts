import { DEFAULT_REQUEST_TIMEOUT_MS, describeUpstreamError, type CompleteRequest, type CompleteResult } from "./types";

// OpenRouter and DeepSeek both speak the OpenAI chat-completions dialect, so the body and
// response handling live here once and each provider only supplies its URL and headers.

export function buildOpenAiBody(request: CompleteRequest): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  if (request.system.trim().length > 0) {
    messages.push({ role: "system", content: request.system });
  }
  messages.push(...request.messages);

  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens,
    messages,
  };

  if (request.mechanism === "native_schema" && request.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: request.schemaName ?? "reply", strict: true, schema: request.schema },
    };
  } else if (request.mechanism === "json_mode") {
    // No shape guarantee — the prompt carries the shape and the parser stays defensive.
    body.response_format = { type: "json_object" };
  }

  return body;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function parseOpenAiResponse(data: OpenAiResponse): CompleteResult {
  const choice = data.choices?.[0];

  return {
    text: choice?.message?.content ?? "",
    truncated: choice?.finish_reason === "length",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

export async function completeWithOpenAiCompatible(
  request: CompleteRequest,
  options: { url: string; headers?: Record<string, string>; timeoutMs?: number },
): Promise<CompleteResult> {
  const response = await fetch(options.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${request.apiKey}`,
      "content-type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(buildOpenAiBody(request)),
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(describeUpstreamError(response.status, await response.text()));
  }

  return parseOpenAiResponse(await response.json());
}
