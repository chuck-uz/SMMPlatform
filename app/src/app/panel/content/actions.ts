"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildPlanSlots, CONTENT_FORMATS, type Horizon, type StrategyInput } from "@/lib/contentPlan";
import { generateContentPlan } from "@/lib/contentPlanClient";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступно только администратору");
  }
}

// Reads the single global strategy row, coercing its JSON knobs into the typed shape the
// prompt builder expects. Absent row → sensible empty defaults, so the section works before
// an admin has configured anything.
async function loadStrategyInput(): Promise<StrategyInput> {
  const row = await prisma.contentStrategy.findUnique({ where: { singleton: "content" } });
  const pillars = Array.isArray(row?.pillars)
    ? (row.pillars as Array<{ name?: unknown; description?: unknown }>).map((p) => ({
        name: typeof p?.name === "string" ? p.name : "",
        description: typeof p?.description === "string" ? p.description : "",
      }))
    : [];
  const formats = Array.isArray(row?.formats)
    ? (row.formats as unknown[]).filter((f): f is string => typeof f === "string")
    : [];

  return {
    brandVoice: row?.brandVoice ?? "",
    audience: row?.audience ?? "",
    goal: row?.goal ?? "",
    seasonal: row?.seasonal ?? "",
    avoidTopics: row?.avoidTopics ?? "",
    postsPerWeek: row?.postsPerWeek ?? 3,
    pillars,
    formats,
  };
}

export async function saveContentStrategyAction(input: StrategyInput) {
  await requireAdmin();

  const postsPerWeek = Math.min(14, Math.max(1, Math.floor(input.postsPerWeek) || 1));
  const pillars = input.pillars
    .filter((p) => p.name.trim())
    .map((p) => ({ name: p.name.trim(), description: p.description.trim() }));
  const formats = input.formats.filter((f) => (CONTENT_FORMATS as readonly string[]).includes(f));

  const data = {
    brandVoice: input.brandVoice.trim(),
    audience: input.audience.trim(),
    goal: input.goal.trim(),
    seasonal: input.seasonal.trim(),
    avoidTopics: input.avoidTopics.trim(),
    postsPerWeek,
    pillars: pillars as unknown as Prisma.InputJsonValue,
    formats: formats as unknown as Prisma.InputJsonValue,
  };

  await prisma.contentStrategy.upsert({
    where: { singleton: "content" },
    create: { singleton: "content", ...data },
    update: data,
  });

  revalidatePath("/panel/content");
}

// Best-effort grounding: the latest account-insight report and the agent knowledge base, if
// they exist. The plan generates fine without them — grounding only sharpens it.
async function buildGrounding(): Promise<string> {
  const [latestReport, knowledge] = await Promise.all([
    prisma.accountInsightReport.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.agentKnowledgeDocument.findMany({ orderBy: { createdAt: "asc" }, take: 8 }),
  ]);

  const parts: string[] = [];
  if (latestReport && latestReport.content && typeof latestReport.content === "object") {
    const content = latestReport.content as { summary?: unknown; direction?: unknown };
    if (typeof content.summary === "string") parts.push(`Итог по аккаунту: ${content.summary}`);
    if (typeof content.direction === "string") parts.push(`Направление развития: ${content.direction}`);
  }
  for (const doc of knowledge) {
    parts.push(`Знание «${doc.title}»: ${doc.body.slice(0, 400)}`);
  }
  return parts.join("\n");
}

export async function generateContentPlanAction(params: { horizon: Horizon }) {
  await requireAdmin();

  const strategy = await loadStrategyInput();
  const grounding = await buildGrounding();

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const slots = buildPlanSlots({ horizon: params.horizon, startDate, postsPerWeek: strategy.postsPerWeek });

  const { plan, provider, model } = await generateContentPlan({
    strategy,
    horizon: params.horizon,
    slotCount: slots.length,
    grounding,
  });

  // The model returns content per slot in order; pair each with the date we computed. If the
  // model returned fewer items than slots, we only fill what it gave (never invent slots).
  const created = await prisma.contentPlan.create({
    data: {
      horizon: params.horizon,
      startDate,
      rationale: plan.rationale,
      provider,
      model,
      items: {
        create: plan.items.slice(0, slots.length).map((item, index) => ({
          slotDate: slots[index],
          rubric: item.rubric,
          idea: item.idea,
          captionDraft: item.captionDraft,
          hashtags: item.hashtags,
          format: item.format,
          position: index,
        })),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  revalidatePath("/panel/content");
  return { planId: created.id };
}

export async function updatePlanItemAction(params: {
  itemId: string;
  captionDraft: string;
  hashtags: string;
  idea: string;
}) {
  await requireAdmin();

  await prisma.contentPlanItem.update({
    where: { id: params.itemId },
    data: {
      captionDraft: params.captionDraft,
      hashtags: params.hashtags,
      idea: params.idea,
      edited: true,
    },
  });

  revalidatePath("/panel/content");
}

export async function deletePlanAction(planId: string) {
  await requireAdmin();

  await prisma.contentPlan.delete({ where: { id: planId } });

  revalidatePath("/panel/content");
}
