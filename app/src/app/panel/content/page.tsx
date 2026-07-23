import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ContentStrategyForm } from "@/components/ContentStrategyForm";
import { ContentPlanGenerator } from "@/components/ContentPlanGenerator";
import { ContentPlanView, type PlanView } from "@/components/ContentPlanView";
import type { StrategyInput } from "@/lib/contentPlan";

export default async function ContentPage() {
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

  const [strategyRow, planRows] = await Promise.all([
    prisma.contentStrategy.findUnique({ where: { singleton: "content" } }),
    prisma.contentPlan.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { orderBy: { position: "asc" } } },
    }),
  ]);

  const pillars = Array.isArray(strategyRow?.pillars)
    ? (strategyRow.pillars as Array<{ name?: unknown; description?: unknown }>).map((p) => ({
        name: typeof p?.name === "string" ? p.name : "",
        description: typeof p?.description === "string" ? p.description : "",
      }))
    : [];
  const formats = Array.isArray(strategyRow?.formats)
    ? (strategyRow.formats as unknown[]).filter((f): f is string => typeof f === "string")
    : [];

  const strategy: StrategyInput = {
    brandVoice: strategyRow?.brandVoice ?? "",
    audience: strategyRow?.audience ?? "",
    goal: strategyRow?.goal ?? "",
    seasonal: strategyRow?.seasonal ?? "",
    avoidTopics: strategyRow?.avoidTopics ?? "",
    postsPerWeek: strategyRow?.postsPerWeek ?? 3,
    pillars,
    formats,
  };

  const plans: PlanView[] = planRows.map((plan) => ({
    id: plan.id,
    horizon: plan.horizon,
    startDate: plan.startDate.toISOString(),
    rationale: plan.rationale,
    provider: plan.provider,
    model: plan.model,
    createdAt: plan.createdAt.toISOString(),
    items: plan.items.map((item) => ({
      id: item.id,
      slotDate: item.slotDate.toISOString(),
      rubric: item.rubric,
      idea: item.idea,
      captionDraft: item.captionDraft,
      hashtags: item.hashtags,
      format: item.format,
      edited: item.edited,
    })),
  }));

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        AI-стратегия и контент-план: настройте, о чём и как ведётся аккаунт, и модель предложит
        обоснованный план публикаций с черновиками подписей. Публикация и календарь — отдельно, здесь
        только генерация.
      </p>

      <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Стратегия ведения</h2>
      <div className="mt-3 max-w-[1020px]">
        <ContentStrategyForm initial={strategy} />
      </div>

      <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Сгенерировать план</h2>
      <div className="mt-3 max-w-[1020px]">
        <ContentPlanGenerator />
      </div>

      <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Планы</h2>
      <div className="mt-3 flex max-w-[1020px] flex-col gap-4">
        {plans.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-[13.5px] text-muted-foreground shadow-card">
            Планов пока нет. Настройте стратегию выше и сгенерируйте первый план.
          </div>
        ) : (
          plans.map((plan) => <ContentPlanView key={plan.id} plan={plan} />)
        )}
      </div>
    </div>
  );
}
