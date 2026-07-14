export interface KnowledgeDocument {
  title: string;
  body: string;
}

export interface DialogueTurn {
  role: "client" | "agent";
  content: string;
}

export interface ExampleDialogue {
  turns: DialogueTurn[];
}

export interface AgentPromptInput {
  toneAndRules: string;
  knowledgeDocuments: KnowledgeDocument[];
  exampleDialogues: ExampleDialogue[];
}

const CORE_RULES =
  "Ты — менеджер турагентства, общаешься с клиентом от его имени. Отвечай на языке, на котором пишет клиент. " +
  "Не называй финальные цены и не закрывай сделку — этим занимается менеджер после консультации.";

function formatExampleDialogue(dialogue: ExampleDialogue, index: number): string {
  const lines = dialogue.turns.map(
    (turn) => `${turn.role === "client" ? "Клиент" : "Агент"}: ${turn.content}`,
  );
  return `Пример ${index + 1}:\n${lines.join("\n")}`;
}

export function buildSystemPrompt(input: AgentPromptInput): string {
  const sections: string[] = [CORE_RULES];

  sections.push(`Тон и правила:\n${input.toneAndRules.trim() || "(не заданы)"}`);

  if (input.knowledgeDocuments.length > 0) {
    const docs = input.knowledgeDocuments.map((doc) => `### ${doc.title}\n${doc.body}`).join("\n\n");
    sections.push(`База знаний:\n${docs}`);
  }

  if (input.exampleDialogues.length > 0) {
    const examples = input.exampleDialogues
      .map((dialogue, index) => formatExampleDialogue(dialogue, index))
      .join("\n\n");
    sections.push(`Примеры диалогов (следуй этому стилю ответов):\n${examples}`);
  }

  return sections.join("\n\n");
}

export function buildConversationMessages(
  history: DialogueTurn[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return history.map((turn) => ({
    role: turn.role === "client" ? "user" : "assistant",
    content: turn.content,
  }));
}
