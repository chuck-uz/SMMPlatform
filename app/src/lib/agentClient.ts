import { parseAgentReplyContent, type AgentReplyContent } from "./leadFields";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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
  model: string,
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
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      output_config: { format: { type: "json_schema", schema: REPLY_OUTPUT_SCHEMA } },
    }),
  });
  console.log(`[agentClient] Claude call took ${Date.now() - startedAt}ms, status ${response.status}`);

  if (!response.ok) {
    const bodyText = await response.text();
    const detail = bodyText.trim().startsWith("<") ? "upstream returned an error page, not JSON" : bodyText.slice(0, 500);
    throw new Error(`Claude API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  if (data.stop_reason !== "end_turn") {
    console.log(`[agentClient] non-standard stop_reason: ${data.stop_reason}, model: ${model}`);
  }
  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseAgentReplyContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude вернул ответ, не соответствующий ожидаемой схеме");
  }

  return parsed;
}
