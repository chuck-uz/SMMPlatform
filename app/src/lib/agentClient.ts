import { parseAgentReplyContent, type AgentReplyContent } from "./leadFields";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";

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

export async function respondAndExtractLead(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<AgentReplyContent> {
  const startedAt = Date.now();
  const response = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      output_config: { format: { type: "json_schema", schema: REPLY_OUTPUT_SCHEMA } },
    }),
  });
  console.log(`[agentClient] Claude call took ${Date.now() - startedAt}ms, status ${response.status}`);

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseAgentReplyContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude вернул ответ, не соответствующий ожидаемой схеме");
  }

  return parsed;
}
