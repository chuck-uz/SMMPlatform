import { describe, expect, it } from "vitest";
import { buildAnthropicBody, parseAnthropicResponse } from "./anthropic";
import { buildOpenAiBody, parseOpenAiResponse } from "./openAiCompatible";
import { supportsStructuredOutputs } from "./openrouter";
import type { CompleteRequest } from "./types";

const base: CompleteRequest = {
  apiKey: "k",
  model: "claude-haiku-4-5-20251001",
  system: "system prompt",
  messages: [{ role: "user", content: "привет" }],
  maxTokens: 4096,
  mechanism: "native_schema",
  schema: { type: "object" },
};

describe("buildAnthropicBody", () => {
  // This is the exact body agentClient/commentReplyClient/claudeInsightsClient sent before
  // the model layer; keeping it identical is what makes the migration a no-op on prod.
  it("reproduces the pre-existing Anthropic request shape", () => {
    expect(buildAnthropicBody(base)).toEqual({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: "system prompt",
      messages: [{ role: "user", content: "привет" }],
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    });
  });

  it("omits output_config when the schema is not being enforced", () => {
    expect(buildAnthropicBody({ ...base, mechanism: "prompt" })).not.toHaveProperty("output_config");
    expect(buildAnthropicBody({ ...base, mechanism: "json_mode" })).not.toHaveProperty("output_config");
  });

  it("omits output_config when no schema was supplied", () => {
    const { schema: _schema, ...withoutSchema } = base;
    expect(buildAnthropicBody(withoutSchema)).not.toHaveProperty("output_config");
  });
});

describe("parseAnthropicResponse", () => {
  it("returns the text block", () => {
    const result = parseAnthropicResponse(
      { content: [{ type: "text", text: "{}" }], usage: { input_tokens: 10, output_tokens: 20 } },
      4096,
    );
    expect(result).toMatchObject({ text: "{}", truncated: false, inputTokens: 10, outputTokens: 20 });
  });

  it("flags truncation when the output ran into the token budget", () => {
    const result = parseAnthropicResponse({ content: [{ type: "text", text: "x" }], usage: { output_tokens: 4090 } }, 4096);
    expect(result.truncated).toBe(true);
  });

  it("survives a response with no text block", () => {
    expect(parseAnthropicResponse({}, 4096).text).toBe("");
  });
});

describe("buildOpenAiBody", () => {
  it("moves the system prompt into the message list", () => {
    const body = buildOpenAiBody({ ...base, mechanism: "prompt" }) as { messages: unknown };
    expect(body.messages).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "привет" },
    ]);
  });

  it("omits an empty system message", () => {
    const body = buildOpenAiBody({ ...base, system: "  ", mechanism: "prompt" }) as { messages: unknown[] };
    expect(body.messages).toEqual([{ role: "user", content: "привет" }]);
  });

  it("asks for a strict json schema when the model supports it", () => {
    const body = buildOpenAiBody({ ...base, schemaName: "lead_reply" }) as { response_format: unknown };
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "lead_reply", strict: true, schema: { type: "object" } },
    });
  });

  it("asks for plain json mode when there is no schema support", () => {
    const body = buildOpenAiBody({ ...base, mechanism: "json_mode" }) as { response_format: unknown };
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("sends no response_format when nothing can be enforced", () => {
    expect(buildOpenAiBody({ ...base, mechanism: "prompt" })).not.toHaveProperty("response_format");
  });
});

describe("parseOpenAiResponse", () => {
  it("returns the first choice's content and usage", () => {
    const result = parseOpenAiResponse({
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 5, completion_tokens: 7 },
    });
    expect(result).toEqual({ text: "{}", truncated: false, inputTokens: 5, outputTokens: 7 });
  });

  it("flags truncation from finish_reason", () => {
    const result = parseOpenAiResponse({ choices: [{ message: { content: "x" }, finish_reason: "length" }] });
    expect(result.truncated).toBe(true);
  });

  it("survives an empty choice list", () => {
    expect(parseOpenAiResponse({}).text).toBe("");
  });
});

describe("supportsStructuredOutputs", () => {
  it("accepts either capability flag OpenRouter reports", () => {
    expect(supportsStructuredOutputs(["structured_outputs"])).toBe(true);
    expect(supportsStructuredOutputs(["response_format"])).toBe(true);
  });

  it("rejects models that advertise neither", () => {
    expect(supportsStructuredOutputs(["tools"])).toBe(false);
    expect(supportsStructuredOutputs([])).toBe(false);
  });

  it("treats a missing capability list as unsupported", () => {
    expect(supportsStructuredOutputs(undefined)).toBe(false);
  });
});
