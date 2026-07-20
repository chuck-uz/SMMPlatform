import { describe, expect, it, vi } from "vitest";
import { complete } from "./index";
import type { CompleteRequest, CompleteResult } from "./types";

const ok = (text: string): CompleteResult => ({ text, truncated: false, inputTokens: 1, outputTokens: 2 });
const cut = (text: string): CompleteResult => ({ text, truncated: true, outputTokens: 4090 });

const parseJson = (text: string) => {
  try {
    return JSON.parse(text) as { reply: string };
  } catch {
    return null;
  }
};

function options(run: (request: CompleteRequest) => Promise<CompleteResult>) {
  return {
    provider: "anthropic" as const,
    model: "claude-haiku-4-5-20251001",
    apiKey: "k",
    system: "система",
    messages: [{ role: "user" as const, content: "привет" }],
    maxTokens: 1024,
    schema: { type: "object" },
    parse: parseJson,
    run,
  };
}

describe("complete", () => {
  it("returns the parsed value without retrying when the first answer is good", async () => {
    const run = vi.fn<(request: CompleteRequest) => Promise<CompleteResult>>(async () => ok('{"reply":"ok"}'));
    const outcome = await complete(options(run));

    expect(outcome.value).toEqual({ reply: "ok" });
    expect(outcome.retries).toBe(0);
    expect(outcome.mechanism).toBe("native_schema");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("repairs once when the first answer cannot be parsed", async () => {
    const run = vi
      .fn<(request: CompleteRequest) => Promise<CompleteResult>>()
      .mockResolvedValueOnce(ok("Конечно! Вот ответ."))
      .mockResolvedValueOnce(ok('{"reply":"ok"}'));

    const outcome = await complete(options(run));

    expect(outcome.value).toEqual({ reply: "ok" });
    expect(outcome.retries).toBe(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("adds a repair instruction to the system prompt on the retry only", async () => {
    const run = vi
      .fn<(request: CompleteRequest) => Promise<CompleteResult>>()
      .mockResolvedValueOnce(ok("нет json"))
      .mockResolvedValueOnce(ok('{"reply":"ok"}'));

    await complete(options(run));

    expect(run.mock.calls[0][0].system).not.toContain("Предыдущий ответ");
    expect(run.mock.calls[1][0].system).toContain("Предыдущий ответ");
  });

  it("repairs a truncated answer even when it happens to parse", async () => {
    const run = vi
      .fn<(request: CompleteRequest) => Promise<CompleteResult>>()
      .mockResolvedValueOnce(cut('{"reply":"обрез'.concat('"}')))
      .mockResolvedValueOnce(ok('{"reply":"ok"}'));

    const outcome = await complete(options(run));
    expect(outcome.retries).toBe(1);
  });

  it("gives up after one repair and names the model that failed", async () => {
    const run = vi.fn(async () => ok("всё ещё не json"));

    await expect(complete(options(run))).rejects.toThrow(/claude-haiku-4-5-20251001.*anthropic/);
    expect(run).toHaveBeenCalledTimes(2);
  });

  // Regression caught on a live DeepSeek run: the model burned two calls and the comparison
  // table still showed "0 retries", making a weak model look free.
  it("reports the repair attempt it spent when it ultimately fails", async () => {
    const run = vi.fn(async () => ok("не json"));

    await expect(complete(options(run))).rejects.toMatchObject({ name: "LlmCompletionError", retries: 1 });
  });

  it("does not append shape instructions when the decoder enforces the schema", async () => {
    const run = vi.fn<(request: CompleteRequest) => Promise<CompleteResult>>(async () => ok('{"reply":"ok"}'));
    await complete(options(run));

    expect(run.mock.calls[0][0].system).toBe("система");
    expect(run.mock.calls[0][0].mechanism).toBe("native_schema");
  });

  it("appends shape instructions when the provider cannot enforce a schema", async () => {
    const run = vi.fn<(request: CompleteRequest) => Promise<CompleteResult>>(async () => ok('{"reply":"ok"}'));
    await complete({ ...options(run), provider: "deepseek" });

    expect(run.mock.calls[0][0].system).toContain("система");
    expect(run.mock.calls[0][0].system.toLowerCase()).toContain("json");
    expect(run.mock.calls[0][0].mechanism).toBe("json_mode");
  });

  it("uses a caller-supplied shape for a non-default structure", async () => {
    const run = vi.fn<(request: CompleteRequest) => Promise<CompleteResult>>(async () => ok('{"reply":"ok"}'));
    await complete({ ...options(run), provider: "deepseek", shape: '{"summary": "..."}' });

    expect(run.mock.calls[0][0].system).toContain('{"summary": "..."}');
  });
});
