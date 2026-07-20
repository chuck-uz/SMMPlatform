"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { respondAndExtractLead } from "@/lib/agentClient";
import { buildConversationMessages, buildSystemPrompt } from "@/lib/agentPrompt";
import {
  buildExampleDialogueTurns,
  canSaveAsExample,
  type SandboxTurn,
} from "@/lib/agentSandbox";
import { isLeadComplete, mergeLeadFields, type LeadFields } from "@/lib/leadFields";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступно только администратору");
  }
}

export async function saveAgentConfigAction(toneAndRules: string) {
  await requireAdmin();

  await prisma.agentConfig.upsert({
    where: { singleton: "agent" },
    create: { singleton: "agent", toneAndRules },
    update: { toneAndRules },
  });

  revalidatePath("/panel/scenarios");
}

export async function saveCommentConfigAction(params: {
  commentToneAndRules: string;
  commentModerationEnabled: boolean;
}) {
  await requireAdmin();

  await prisma.agentConfig.upsert({
    where: { singleton: "agent" },
    create: {
      singleton: "agent",
      commentToneAndRules: params.commentToneAndRules,
      commentModerationEnabled: params.commentModerationEnabled,
    },
    update: {
      commentToneAndRules: params.commentToneAndRules,
      commentModerationEnabled: params.commentModerationEnabled,
    },
  });

  revalidatePath("/panel/scenarios");
}

export async function addKnowledgeDocumentAction(params: { title: string; body: string }) {
  await requireAdmin();

  if (!params.title.trim() || !params.body.trim()) {
    throw new Error("Заголовок и текст документа не могут быть пустыми");
  }

  await prisma.agentKnowledgeDocument.create({ data: { title: params.title, body: params.body } });

  revalidatePath("/panel/scenarios");
}

export async function deleteKnowledgeDocumentAction(id: string) {
  await requireAdmin();

  await prisma.agentKnowledgeDocument.delete({ where: { id } });

  revalidatePath("/panel/scenarios");
}

export async function deleteExampleDialogueAction(id: string) {
  await requireAdmin();

  await prisma.agentExampleDialogue.delete({ where: { id } });

  revalidatePath("/panel/scenarios");
}

async function buildCurrentSystemPrompt() {
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

export async function sendSandboxMessageAction(params: { sessionId: string | null; message: string }) {
  await requireAdmin();

  const session = params.sessionId
    ? await prisma.agentSandboxSession.findUniqueOrThrow({ where: { id: params.sessionId } })
    : null;
  const existingTurns = (session?.turns as unknown as SandboxTurn[]) ?? [];

  const turnsWithClientMessage: SandboxTurn[] = [
    ...existingTurns,
    { role: "client", content: params.message },
  ];

  const systemPrompt = await buildCurrentSystemPrompt();
  const conversationMessages = buildConversationMessages(turnsWithClientMessage);
  // The sandbox now exercises the agent exactly as configured in «Подключения», so what you
  // test here is what clients would get. Model experiments live on the comparison screen.
  const { reply, fields, provider, model } = await respondAndExtractLead(systemPrompt, conversationMessages);

  // Accumulate rather than replace: a turn that forgets an already-collected field must not
  // erase it (a confirmed destination was observed vanishing mid-dialogue this way).
  const previousFields = (session?.leadFields as unknown as LeadFields | null) ?? null;
  const mergedFields = mergeLeadFields(previousFields, fields);

  const updatedTurns: SandboxTurn[] = [
    ...turnsWithClientMessage,
    { role: "agent", content: reply, rating: null },
  ];

  const saved = await prisma.agentSandboxSession.upsert({
    where: { id: params.sessionId ?? "" },
    create: {
      turns: updatedTurns as unknown as Prisma.InputJsonValue,
      leadFields: mergedFields as unknown as Prisma.InputJsonValue,
      model,
    },
    update: {
      turns: updatedTurns as unknown as Prisma.InputJsonValue,
      leadFields: mergedFields as unknown as Prisma.InputJsonValue,
      model,
    },
  });

  revalidatePath("/panel/scenarios");

  return {
    sessionId: saved.id,
    turns: updatedTurns,
    leadFields: mergedFields,
    isComplete: isLeadComplete(mergedFields),
    provider,
    model,
  };
}

export async function rateSandboxTurnAction(params: {
  sessionId: string;
  turnIndex: number;
  rating: "up" | "down";
}) {
  await requireAdmin();

  const session = await prisma.agentSandboxSession.findUniqueOrThrow({ where: { id: params.sessionId } });
  const turns = (session.turns as unknown as SandboxTurn[]).map((turn, index) =>
    index === params.turnIndex ? { ...turn, rating: params.rating } : turn,
  );

  await prisma.agentSandboxSession.update({
    where: { id: params.sessionId },
    data: { turns: turns as unknown as Prisma.InputJsonValue },
  });

  revalidatePath("/panel/scenarios");

  return { turns };
}

export async function saveSandboxSessionAsExampleAction(sessionId: string) {
  await requireAdmin();

  const session = await prisma.agentSandboxSession.findUniqueOrThrow({ where: { id: sessionId } });
  const turns = session.turns as unknown as SandboxTurn[];

  if (!canSaveAsExample(turns)) {
    throw new Error("В диалоге есть ответ агента с 👎 — исправьте или удалите его перед сохранением");
  }

  await prisma.agentExampleDialogue.create({
    data: { turns: buildExampleDialogueTurns(turns) as unknown as Prisma.InputJsonValue },
  });
  await prisma.agentSandboxSession.update({ where: { id: sessionId }, data: { status: "saved" } });

  revalidatePath("/panel/scenarios");
}

export async function discardSandboxSessionAction(sessionId: string) {
  await requireAdmin();

  await prisma.agentSandboxSession.delete({ where: { id: sessionId } });

  revalidatePath("/panel/scenarios");
}
