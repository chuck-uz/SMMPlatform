import { completeWithAnthropic } from "./anthropic";
import { completeWithDeepSeek } from "./deepseek";
import { completeWithOpenRouter } from "./openrouter";
import type { Provider } from "./router";
import {
  buildRepairInstruction,
  buildStructuredOutputInstruction,
  pickOutputMechanism,
  shouldRepairRetry,
  type OutputMechanism,
} from "./structuredOutput";
import type { CompleteRequest, CompleteResult } from "./types";

export type RunAdapter = (request: CompleteRequest) => Promise<CompleteResult>;

function adapterFor(provider: Provider): RunAdapter {
  switch (provider) {
    case "anthropic":
      return (request) => completeWithAnthropic(request);
    case "openrouter":
      return (request) => completeWithOpenRouter(request);
    case "deepseek":
      return (request) => completeWithDeepSeek(request);
  }
}

export interface CompleteOptions<T> {
  provider: Provider;
  model: string;
  apiKey: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens: number;
  schema?: Record<string, unknown>;
  schemaName?: string;
  // Example object shown to models that cannot be schema-constrained.
  shape?: string;
  supportsStructuredOutputs?: boolean;
  // Each call site brings its own validator, because the expected object differs
  // (lead reply vs analytics report).
  parse: (text: string) => T | null;
  // Test seam: lets the retry logic be exercised without hitting a provider.
  run?: RunAdapter;
}

export interface CompleteOutcome<T> {
  value: T;
  mechanism: OutputMechanism;
  retries: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

// Carries how many repair attempts were spent before giving up. Without this the caller
// cannot tell an instant refusal from a model that burned two calls and still failed —
// and the comparison screen would report a failing model as costing nothing.
export class LlmCompletionError extends Error {
  readonly retries: number;

  constructor(message: string, retries: number) {
    super(message);
    this.name = "LlmCompletionError";
    this.retries = retries;
  }
}

export async function complete<T>(options: CompleteOptions<T>): Promise<CompleteOutcome<T>> {
  const mechanism = pickOutputMechanism({
    provider: options.provider,
    supportsStructuredOutputs: options.supportsStructuredOutputs,
  });

  const instruction = buildStructuredOutputInstruction(mechanism, options.shape);
  const baseSystem = instruction ? `${options.system}\n\n${instruction}` : options.system;
  const run = options.run ?? adapterFor(options.provider);

  const startedAt = Date.now();
  let failure = "";
  let attemptsMade = 0;

  for (let attempt = 0; attempt <= 1; attempt++) {
    attemptsMade = attempt + 1;
    const system = attempt === 0 ? baseSystem : `${baseSystem}\n\n${buildRepairInstruction(options.shape)}`;

    const result = await run({
      apiKey: options.apiKey,
      model: options.model,
      system,
      messages: options.messages,
      maxTokens: options.maxTokens,
      mechanism,
      schema: options.schema,
      schemaName: options.schemaName,
    });

    const parsed = options.parse(result.text);

    if (parsed !== null && !result.truncated) {
      return {
        value: parsed,
        mechanism,
        retries: attempt,
        latencyMs: Date.now() - startedAt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    }

    failure = result.truncated
      ? "ответ обрезан по лимиту токенов"
      : "ответ не соответствует ожидаемой структуре";

    if (!shouldRepairRetry({ attempt, parsed, truncated: result.truncated })) break;
  }

  throw new LlmCompletionError(`Модель ${options.model} (${options.provider}): ${failure}`, attemptsMade - 1);
}

export * from "./router";
export * from "./structuredOutput";
export * from "./catalog";
export type { CompleteRequest, CompleteResult } from "./types";
