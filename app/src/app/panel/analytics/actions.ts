"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { analyzeSummary } from "@/lib/claudeAnalysisClient";
import { buildAnalysisPrompt, shouldSkipManualAnalysis } from "@/lib/analysisReport";
import { dailyHistory } from "@/lib/instagramPoller";
import { resolvePeriodRange, buildPeriodSummary, type PeriodPreset } from "@/lib/analyticsSummary";

export async function runManualAnalysisAction(params: {
  accountId: string;
  preset: PeriodPreset;
  from?: string;
  to?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
  if (!encryptionKey || !claudeConfig?.verified) {
    throw new Error("Ключ Claude не настроен или не проверен — подключите его на странице «Подключения»");
  }

  const now = new Date();
  const range = resolvePeriodRange({ preset: params.preset, from: params.from, to: params.to }, now);

  const lastManualReport = await prisma.aiAnalysisReport.findFirst({
    where: {
      accountId: params.accountId,
      trigger: "manual",
      periodFrom: range.from,
      periodTo: range.to,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (shouldSkipManualAnalysis(lastManualReport, now)) {
    throw new Error("Этот период уже разобран меньше 5 минут назад");
  }

  const media = await prisma.instagramMedia.findMany({
    where: { accountId: params.accountId },
    select: { id: true, caption: true, mediaProductType: true, postedAt: true },
  });
  const [accountSnapshots, mediaSnapshots] = await Promise.all([
    prisma.instagramMetricSnapshot.findMany({
      where: { accountId: params.accountId, scope: "account" },
      select: { capturedAt: true, metrics: true },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.instagramMetricSnapshot.findMany({
      where: {
        accountId: params.accountId,
        mediaId: { in: media.map((item) => item.id) },
        scope: { in: ["media", "story"] },
      },
      select: { mediaId: true, capturedAt: true, metrics: true },
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const latestMetricsByMediaId = new Map<string, Record<string, unknown>>();
  for (const snapshot of mediaSnapshots) {
    if (snapshot.mediaId && !latestMetricsByMediaId.has(snapshot.mediaId)) {
      latestMetricsByMediaId.set(snapshot.mediaId, snapshot.metrics as Record<string, unknown>);
    }
  }

  const dailyPoints = dailyHistory(
    accountSnapshots.map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      metrics: snapshot.metrics as Record<string, unknown>,
    })),
  );
  const currentPoints = dailyPoints.filter((point) => {
    const date = new Date(point.date);
    return date >= range.from && date <= range.to;
  });
  const previousPoints = dailyPoints.filter((point) => {
    const date = new Date(point.date);
    return date >= range.previousFrom && date <= range.previousTo;
  });

  const summary = buildPeriodSummary({ range, currentPoints, previousPoints, media, latestMetricsByMediaId });
  const prompt = buildAnalysisPrompt(summary);
  const apiKey = decrypt(claudeConfig.encryptedApiKey, encryptionKey);
  const content = await analyzeSummary(apiKey, prompt);

  await prisma.aiAnalysisReport.create({
    data: {
      accountId: params.accountId,
      periodFrom: range.from,
      periodTo: range.to,
      trigger: "manual",
      content: content as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/panel/analytics");
}
