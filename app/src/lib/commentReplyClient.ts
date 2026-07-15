import { parseCommentReplyContent, type CommentReplyContent } from "./commentReply";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 60_000;

const REPLY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Публичный ответ на комментарий клиента" },
  },
  required: ["reply"],
  additionalProperties: false,
};

export async function generateCommentReply(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<CommentReplyContent> {
  const response = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: { type: "json_schema", schema: REPLY_OUTPUT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const detail = bodyText.trim().startsWith("<") ? "upstream returned an error page, not JSON" : bodyText.slice(0, 500);
    throw new Error(`Claude API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const outputTokens = data.usage?.output_tokens;
  console.log(
    `[commentReplyClient] stop_reason=${data.stop_reason}, output_tokens=${outputTokens}, max_tokens=${MAX_TOKENS}`,
  );

  // Same truncation-masked-as-end_turn risk as agentClient.ts — detect via output_tokens,
  // not stop_reason alone.
  if (typeof outputTokens === "number" && outputTokens >= MAX_TOKENS - 16) {
    throw new Error("Claude ответ обрезан по лимиту токенов — повторите запрос");
  }

  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseCommentReplyContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude вернул ответ, не соответствующий ожидаемой схеме");
  }

  return parsed;
}
