import { describe, expect, it } from "vitest";
import { buildConversationMessages, buildSystemPrompt } from "./agentPrompt";

describe("buildSystemPrompt", () => {
  it("always includes the core no-price/no-close rule", () => {
    const prompt = buildSystemPrompt({ toneAndRules: "", knowledgeDocuments: [], exampleDialogues: [] });
    expect(prompt).toContain("Не называй финальные цены");
  });

  it("includes tone and rules text", () => {
    const prompt = buildSystemPrompt({
      toneAndRules: "Дружелюбно, на 'вы', с эмодзи в меру.",
      knowledgeDocuments: [],
      exampleDialogues: [],
    });
    expect(prompt).toContain("Дружелюбно, на 'вы', с эмодзи в меру.");
  });

  it("shows a placeholder when tone and rules are empty", () => {
    const prompt = buildSystemPrompt({ toneAndRules: "   ", knowledgeDocuments: [], exampleDialogues: [] });
    expect(prompt).toContain("(не заданы)");
  });

  it("omits the knowledge base section when there are no documents", () => {
    const prompt = buildSystemPrompt({ toneAndRules: "тон", knowledgeDocuments: [], exampleDialogues: [] });
    expect(prompt).not.toContain("База знаний");
  });

  it("includes knowledge document titles and bodies", () => {
    const prompt = buildSystemPrompt({
      toneAndRules: "тон",
      knowledgeDocuments: [{ title: "Турция", body: "Все включено, вылеты по вторникам." }],
      exampleDialogues: [],
    });
    expect(prompt).toContain("Турция");
    expect(prompt).toContain("Все включено, вылеты по вторникам.");
  });

  it("omits the examples section when there are no example dialogues", () => {
    const prompt = buildSystemPrompt({ toneAndRules: "тон", knowledgeDocuments: [], exampleDialogues: [] });
    expect(prompt).not.toContain("Примеры диалогов");
  });

  it("formats example dialogue turns with Клиент/Агент labels", () => {
    const prompt = buildSystemPrompt({
      toneAndRules: "тон",
      knowledgeDocuments: [],
      exampleDialogues: [
        {
          turns: [
            { role: "client", content: "Сколько стоит тур в Египет?" },
            { role: "agent", content: "Подскажите даты и количество человек?" },
          ],
        },
      ],
    });
    expect(prompt).toContain("Клиент: Сколько стоит тур в Египет?");
    expect(prompt).toContain("Агент: Подскажите даты и количество человек?");
  });

  it("numbers multiple example dialogues", () => {
    const prompt = buildSystemPrompt({
      toneAndRules: "тон",
      knowledgeDocuments: [],
      exampleDialogues: [
        { turns: [{ role: "client", content: "Первый" }] },
        { turns: [{ role: "client", content: "Второй" }] },
      ],
    });
    expect(prompt).toContain("Пример 1:");
    expect(prompt).toContain("Пример 2:");
  });
});

describe("buildConversationMessages", () => {
  it("maps client turns to user and agent turns to assistant, preserving order", () => {
    const messages = buildConversationMessages([
      { role: "client", content: "Привет" },
      { role: "agent", content: "Здравствуйте!" },
      { role: "client", content: "Хочу тур в Дубай" },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "Привет" },
      { role: "assistant", content: "Здравствуйте!" },
      { role: "user", content: "Хочу тур в Дубай" },
    ]);
  });

  it("returns an empty array for empty history", () => {
    expect(buildConversationMessages([])).toEqual([]);
  });
});
