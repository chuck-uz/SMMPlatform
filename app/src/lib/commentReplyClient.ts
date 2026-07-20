import { parseCommentReplyContent, type CommentReplyContent } from "./commentReply";
import { complete } from "./llm";
import { resolveInteraction, type InteractionOverride } from "./llm/resolve";
import { extractJsonObject, looksLikeGarbledReply } from "./llm/structuredOutput";

const MAX_TOKENS = 1024;
const SHAPE = '{"reply": "<публичный ответ на комментарий>"}';

const REPLY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Публичный ответ на комментарий клиента" },
  },
  required: ["reply"],
  additionalProperties: false,
};

export async function generateCommentReply(
  systemPrompt: string,
  userMessage: string,
  override?: InteractionOverride,
): Promise<CommentReplyContent> {
  const resolved = await resolveInteraction("comment_reply", override);

  const outcome = await complete({
    provider: resolved.provider,
    model: resolved.model,
    apiKey: resolved.apiKey,
    supportsStructuredOutputs: resolved.supportsStructuredOutputs,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: MAX_TOKENS,
    schema: REPLY_OUTPUT_SCHEMA,
    schemaName: "comment_reply",
    shape: SHAPE,
    // Same garbled-output guard as the agent dialogue: a comment reply is published
    // publicly, so structural noise must never reach it.
    parse: (text) => {
      const parsed = parseCommentReplyContent(extractJsonObject(text));
      if (!parsed || looksLikeGarbledReply(parsed.reply)) return null;
      return parsed;
    },
  });

  console.log(
    `[commentReplyClient] ${resolved.provider}/${resolved.model} mechanism=${outcome.mechanism} ` +
      `retries=${outcome.retries} ${outcome.latencyMs}ms output_tokens=${outcome.outputTokens}`,
  );

  return outcome.value;
}
