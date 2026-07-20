import type { AgentReplyContent } from "./leadFields";
import { complete } from "./llm";
import { resolveInteraction, type InteractionOverride } from "./llm/resolve";
import { parseStructuredReply } from "./llm/structuredOutput";

const MAX_TOKENS = 4096;

const REPLY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Ответ клиенту в диалоге" },
    fields: {
      type: "object",
      properties: {
        destination: { type: ["string", "null"] },
        people: { type: ["string", "null"] },
        dates: { type: ["string", "null"] },
        budget: { type: ["string", "null"] },
        contact: { type: ["string", "null"] },
        wishes: { type: ["string", "null"] },
      },
      required: ["destination", "people", "dates", "budget", "contact", "wishes"],
      additionalProperties: false,
    },
  },
  required: ["reply", "fields"],
  additionalProperties: false,
};

export interface AgentReplyOutcome extends AgentReplyContent {
  provider: string;
  model: string;
  mechanism: string;
  retries: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export async function respondAndExtractLead(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  override?: InteractionOverride,
): Promise<AgentReplyOutcome> {
  const resolved = await resolveInteraction("agent_dialog", override);

  const outcome = await complete({
    provider: resolved.provider,
    model: resolved.model,
    apiKey: resolved.apiKey,
    supportsStructuredOutputs: resolved.supportsStructuredOutputs,
    system: systemPrompt,
    messages,
    maxTokens: MAX_TOKENS,
    schema: REPLY_OUTPUT_SCHEMA,
    schemaName: "lead_reply",
    parse: parseStructuredReply,
  });

  console.log(
    `[agentClient] ${resolved.provider}/${resolved.model} mechanism=${outcome.mechanism} ` +
      `retries=${outcome.retries} ${outcome.latencyMs}ms output_tokens=${outcome.outputTokens}`,
  );

  return {
    ...outcome.value,
    provider: resolved.provider,
    model: resolved.model,
    mechanism: outcome.mechanism,
    retries: outcome.retries,
    latencyMs: outcome.latencyMs,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
  };
}
