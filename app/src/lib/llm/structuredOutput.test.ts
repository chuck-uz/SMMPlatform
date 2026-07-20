import { describe, expect, it } from "vitest";
import {
  buildRepairInstruction,
  buildStructuredOutputInstruction,
  extractJsonObject,
  parseStructuredReply,
  pickOutputMechanism,
  shouldRepairRetry,
} from "./structuredOutput";

describe("pickOutputMechanism", () => {
  it("uses the native schema for Anthropic", () => {
    expect(pickOutputMechanism({ provider: "anthropic" })).toBe("native_schema");
  });

  it("uses JSON mode for DeepSeek, which has no schema support", () => {
    expect(pickOutputMechanism({ provider: "deepseek" })).toBe("json_mode");
  });

  it("uses the native schema on OpenRouter only when the model advertises it", () => {
    expect(pickOutputMechanism({ provider: "openrouter", supportsStructuredOutputs: true })).toBe("native_schema");
    expect(pickOutputMechanism({ provider: "openrouter", supportsStructuredOutputs: false })).toBe("prompt");
  });

  it("assumes no support on OpenRouter when the capability is unknown", () => {
    expect(pickOutputMechanism({ provider: "openrouter" })).toBe("prompt");
  });

  it("falls back to prompting for an unknown provider", () => {
    expect(pickOutputMechanism({ provider: "whatever" })).toBe("prompt");
  });
});

describe("buildStructuredOutputInstruction", () => {
  it("adds nothing when the decoder already enforces the schema", () => {
    expect(buildStructuredOutputInstruction("native_schema")).toBe("");
  });

  // DeepSeek rejects a JSON-mode request unless the word "json" appears in the prompt.
  it("mentions JSON for json mode", () => {
    expect(buildStructuredOutputInstruction("json_mode").toLowerCase()).toContain("json");
  });

  it("describes the required shape when only prompting can enforce it", () => {
    const instruction = buildStructuredOutputInstruction("prompt");
    expect(instruction).toContain("reply");
    expect(instruction).toContain("fields");
    expect(instruction.toLowerCase()).toContain("json");
  });
});

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("ignores a conversational preamble before the object", () => {
    expect(extractJsonObject('Конечно, вот ответ: {"a":1}')).toEqual({ a: 1 });
  });

  it("unwraps a fenced code block", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores trailing commentary after the object", () => {
    expect(extractJsonObject('{"a":1}\nНадеюсь, это помогло!')).toEqual({ a: 1 });
  });

  it("keeps braces that live inside strings", () => {
    expect(extractJsonObject('{"a":"{not json}"}')).toEqual({ a: "{not json}" });
  });

  it("handles escaped quotes inside strings", () => {
    expect(extractJsonObject('{"a":"say \\"hi\\""}')).toEqual({ a: 'say "hi"' });
  });

  it("returns null when there is no object at all", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });

  it("returns null for a truncated object", () => {
    expect(extractJsonObject('{"a":1')).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractJsonObject("")).toBeNull();
  });
});

describe("parseStructuredReply", () => {
  const valid = {
    reply: "Здравствуйте!",
    fields: { destination: "Дубай", people: null, dates: null, budget: null, contact: null, wishes: null },
  };

  it("parses a well-formed reply", () => {
    expect(parseStructuredReply(JSON.stringify(valid))).toEqual(valid);
  });

  it("parses a reply wrapped in prose and fences", () => {
    expect(parseStructuredReply("Вот: ```json\n" + JSON.stringify(valid) + "\n```")).toEqual(valid);
  });

  it("returns null when the object does not match the lead-reply shape", () => {
    expect(parseStructuredReply('{"reply":"hi"}')).toBeNull();
  });

  it("returns null for null or empty input", () => {
    expect(parseStructuredReply(null)).toBeNull();
    expect(parseStructuredReply("")).toBeNull();
  });
});

describe("shouldRepairRetry", () => {
  it("retries once when the answer could not be parsed", () => {
    expect(shouldRepairRetry({ attempt: 0, parsed: null, truncated: false })).toBe(true);
  });

  it("retries once when the answer was cut off by the token budget", () => {
    expect(shouldRepairRetry({ attempt: 0, parsed: null, truncated: true })).toBe(true);
  });

  it("does not retry a successful answer", () => {
    expect(shouldRepairRetry({ attempt: 0, parsed: { reply: "ok" }, truncated: false })).toBe(false);
  });

  // One repair attempt only: a model that cannot comply twice is a model we want to see failing,
  // not one we want to keep paying for.
  it("never retries more than once", () => {
    expect(shouldRepairRetry({ attempt: 1, parsed: null, truncated: false })).toBe(false);
  });
});

describe("buildRepairInstruction", () => {
  it("demands a bare JSON object with no commentary", () => {
    const instruction = buildRepairInstruction();
    expect(instruction.toLowerCase()).toContain("json");
    expect(instruction).toContain("reply");
    expect(instruction).toContain("fields");
  });
});
