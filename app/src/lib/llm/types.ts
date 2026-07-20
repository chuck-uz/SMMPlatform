import type { OutputMechanism } from "./structuredOutput";

// The single shape every call site uses, whatever provider ends up serving it.
export interface CompleteRequest {
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens: number;
  mechanism: OutputMechanism;
  // JSON Schema describing the expected object; only used when the mechanism is native_schema.
  schema?: Record<string, unknown>;
  schemaName?: string;
}

export interface CompleteResult {
  text: string;
  // The provider stopped because the token budget ran out, so the text is probably cut off.
  truncated: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export function describeUpstreamError(status: number, bodyText: string): string {
  // Gateways return HTML error pages; surfacing 500 characters of markup helps nobody.
  const detail = bodyText.trim().startsWith("<") ? "upstream returned an error page, not JSON" : bodyText.slice(0, 500);
  return `LLM API error ${status}: ${detail}`;
}
