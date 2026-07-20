import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ModelComparison, type ExampleOption, type ModelOption } from "@/components/ModelComparison";
import { INTERACTION_TYPES, PROVIDER_LABELS, resolveRoute } from "@/lib/llm/router";
import { targetKey } from "@/lib/modelComparison";

function previewOf(turns: Array<{ role: string; content: string }>, createdAt: Date): string {
  const firstClientLine = turns.find((turn) => turn.role === "client")?.content ?? "(без реплик клиента)";
  const date = createdAt.toISOString().slice(0, 10);
  return `${date} · ${firstClientLine.slice(0, 70)}${firstClientLine.length > 70 ? "…" : ""}`;
}

export default async function ModelsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return (
      <div className="p-6 sm:p-8 sm:px-10">
        <p className="text-[14.5px] text-muted-foreground">Раздел доступен только администратору.</p>
      </div>
    );
  }

  const [dialogues, credentials, routeRows] = await Promise.all([
    prisma.agentExampleDialogue.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.llmProviderCredential.findMany({ select: { provider: true } }),
    prisma.llmRouteConfig.findMany(),
  ]);

  const examples: ExampleOption[] = dialogues.map((dialogue) => {
    const turns = dialogue.turns as unknown as Array<{ role: string; content: string }>;
    return { id: dialogue.id, preview: previewOf(turns, dialogue.createdAt), turns };
  });

  // Quick picks: whatever the interaction points are configured with right now.
  const seen = new Set<string>();
  const modelOptions: ModelOption[] = [];
  for (const interactionType of INTERACTION_TYPES) {
    const target = resolveRoute(interactionType, routeRows);
    const option: ModelOption = {
      provider: target.provider,
      model: target.model,
      label: `${PROVIDER_LABELS[target.provider]} · ${target.model}`,
    };
    if (!seen.has(targetKey(option))) {
      seen.add(targetKey(option));
      modelOptions.push(option);
    }
  }

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[720px] text-[14.5px] leading-relaxed text-muted-foreground">
        Прогон одного и того же сценария по нескольким моделям — чтобы выбрать ту, что лучше
        говорит с клиентами, по данным, а не по ощущениям. Смотрите не только на текст ответа, но и
        на то, сколько полей заявки модель успела собрать и сколько раз ей потребовался повтор.
      </p>

      <div className="mt-6 max-w-[1020px]">
        <ModelComparison
          examples={examples}
          modelOptions={modelOptions}
          availableProviders={credentials.map((credential) => credential.provider)}
        />
      </div>
    </div>
  );
}
