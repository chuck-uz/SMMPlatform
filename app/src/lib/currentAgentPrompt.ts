import { buildSystemPrompt } from "./agentPrompt";
import { prisma } from "./prisma";
import type { SandboxTurn } from "./agentSandbox";

// The agent's live configuration as a system prompt. Shared by the sandbox and the model
// comparison so both exercise exactly the same agent, only the model differs.
export async function buildCurrentAgentSystemPrompt(): Promise<string> {
  const [config, knowledgeDocuments, exampleDialogues] = await Promise.all([
    prisma.agentConfig.findUnique({ where: { singleton: "agent" } }),
    prisma.agentKnowledgeDocument.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.agentExampleDialogue.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return buildSystemPrompt({
    toneAndRules: config?.toneAndRules ?? "",
    knowledgeDocuments: knowledgeDocuments.map((doc) => ({ title: doc.title, body: doc.body })),
    exampleDialogues: exampleDialogues.map((dialogue) => ({
      turns: dialogue.turns as unknown as SandboxTurn[],
    })),
  });
}
