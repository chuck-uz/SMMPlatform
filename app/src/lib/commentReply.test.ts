import { describe, expect, it } from "vitest";
import { buildCommentReplySystemPrompt, buildCommentUserMessage, parseCommentReplyContent } from "./commentReply";

describe("buildCommentReplySystemPrompt", () => {
  it("always includes the no-price/no-contact-request rule", () => {
    const prompt = buildCommentReplySystemPrompt({ commentToneAndRules: "", knowledgeDocuments: [] });
    expect(prompt).toContain("Никогда не называй финальные цены и не проси контакт");
  });

  it("includes comment tone and rules text", () => {
    const prompt = buildCommentReplySystemPrompt({
      commentToneAndRules: "Отвечай тепло, максимум одна фраза.",
      knowledgeDocuments: [],
    });
    expect(prompt).toContain("Отвечай тепло, максимум одна фраза.");
  });

  it("shows a placeholder when tone and rules are empty", () => {
    const prompt = buildCommentReplySystemPrompt({ commentToneAndRules: "   ", knowledgeDocuments: [] });
    expect(prompt).toContain("(не заданы)");
  });

  it("omits the knowledge base section when there are no documents", () => {
    const prompt = buildCommentReplySystemPrompt({ commentToneAndRules: "тон", knowledgeDocuments: [] });
    expect(prompt).not.toContain("База знаний");
  });

  it("includes knowledge document titles and bodies", () => {
    const prompt = buildCommentReplySystemPrompt({
      commentToneAndRules: "тон",
      knowledgeDocuments: [{ title: "Турция", body: "Все включено, вылеты по вторникам." }],
    });
    expect(prompt).toContain("Турция");
    expect(prompt).toContain("Все включено, вылеты по вторникам.");
  });

  it("does not include lead-collection instructions", () => {
    const prompt = buildCommentReplySystemPrompt({ commentToneAndRules: "", knowledgeDocuments: [] });
    expect(prompt).not.toContain("собирай заявку клиента");
  });
});

describe("buildCommentUserMessage", () => {
  it("includes the username when present", () => {
    expect(buildCommentUserMessage({ text: "Красиво!", username: "ivan" })).toBe(
      "Комментарий от ivan: Красиво!",
    );
  });

  it("omits the username when absent", () => {
    expect(buildCommentUserMessage({ text: "Красиво!", username: null })).toBe("Комментарий: Красиво!");
  });
});

describe("parseCommentReplyContent", () => {
  it("parses a valid reply object", () => {
    expect(parseCommentReplyContent({ reply: "Спасибо!" })).toEqual({ reply: "Спасибо!" });
  });

  it("returns null for missing reply field", () => {
    expect(parseCommentReplyContent({})).toBeNull();
  });

  it("returns null for non-string reply", () => {
    expect(parseCommentReplyContent({ reply: 42 })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseCommentReplyContent(null)).toBeNull();
    expect(parseCommentReplyContent("text")).toBeNull();
  });
});
