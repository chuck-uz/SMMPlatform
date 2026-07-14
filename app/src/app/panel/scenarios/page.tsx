import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScenarioEditor } from "@/components/ScenarioEditor";
import { KnowledgeBaseList } from "@/components/KnowledgeBaseList";
import { ExamplesList } from "@/components/ExamplesList";
import { SandboxChat } from "@/components/SandboxChat";
import type { SandboxTurn } from "@/lib/agentSandbox";
import type { DialogueTurn } from "@/lib/agentPrompt";

export default async function ScenariosPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return (
      <div className="p-6 sm:p-8 sm:px-10">
        <div className="max-w-[1020px] rounded-[14px] border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
          Этот раздел доступен только администратору.
        </div>
      </div>
    );
  }

  const [config, knowledgeDocuments, exampleDialogues, draftSession] = await Promise.all([
    prisma.agentConfig.findUnique({ where: { singleton: "agent" } }),
    prisma.agentKnowledgeDocument.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.agentExampleDialogue.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.agentSandboxSession.findFirst({
      where: { status: "draft" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        Тон и правила, база знаний по турам и эталонные диалоги — на этом строится каждый ответ
        AI-агента. Проверяйте изменения в песочнице ниже, прежде чем они попадут в реальные каналы.
      </p>

      <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Сценарий и тон</h2>
      <div className="mt-3 max-w-[1020px]">
        <ScenarioEditor initialToneAndRules={config?.toneAndRules ?? ""} />
      </div>

      <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">База знаний</h2>
      <div className="mt-3 max-w-[1020px]">
        <KnowledgeBaseList documents={knowledgeDocuments} />
      </div>

      <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Примеры диалогов</h2>
      <div className="mt-3 max-w-[1020px]">
        <ExamplesList
          examples={exampleDialogues.map((dialogue) => ({
            id: dialogue.id,
            turns: dialogue.turns as unknown as DialogueTurn[],
          }))}
        />
      </div>

      <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Песочница</h2>
      <p className="mt-1 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
        Пообщайтесь с агентом от лица тестового клиента. Оценивайте ответы 👍/👎 и сохраняйте
        удачные диалоги как примеры.
      </p>
      <div className="mt-3 max-w-[1020px]">
        <SandboxChat
          initialSessionId={draftSession?.id ?? null}
          initialTurns={(draftSession?.turns as unknown as SandboxTurn[]) ?? []}
        />
      </div>
    </div>
  );
}
