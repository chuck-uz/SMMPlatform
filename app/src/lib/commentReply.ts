export interface KnowledgeDocument {
  title: string;
  body: string;
}

export interface CommentReplyPromptInput {
  commentToneAndRules: string;
  knowledgeDocuments: KnowledgeDocument[];
}

const CORE_RULES =
  "Ты — менеджер турагентства, отвечаешь на комментарий клиента под постом в Instagram. Ответ будет опубликован " +
  "как обычный публичный комментарий, который увидят все. Отвечай на языке комментария, коротко и по делу. " +
  "Никогда не называй финальные цены и не проси контакт (телефон, номер, почту) — под постом это публично, " +
  "личные данные там неуместны. Никогда не выдумывай детали туров, которых нет в базе знаний.";

export function buildCommentReplySystemPrompt(input: CommentReplyPromptInput): string {
  const sections: string[] = [CORE_RULES];

  sections.push(`Тон и правила для комментариев:\n${input.commentToneAndRules.trim() || "(не заданы)"}`);

  if (input.knowledgeDocuments.length > 0) {
    const docs = input.knowledgeDocuments.map((doc) => `### ${doc.title}\n${doc.body}`).join("\n\n");
    sections.push(`База знаний:\n${docs}`);
  }

  return sections.join("\n\n");
}

export function buildCommentUserMessage(comment: { text: string; username: string | null }): string {
  return comment.username
    ? `Комментарий от ${comment.username}: ${comment.text}`
    : `Комментарий: ${comment.text}`;
}

export interface CommentReplyContent {
  reply: string;
}

export function parseCommentReplyContent(raw: unknown): CommentReplyContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.reply !== "string") return null;
  return { reply: obj.reply };
}
