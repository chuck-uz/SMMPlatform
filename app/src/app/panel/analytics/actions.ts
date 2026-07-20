"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { analyzeAccountInsights } from "@/lib/claudeInsightsClient";
import {
  buildMediaFormatEngagements,
  buildFormatBreakdown,
  buildMetricTrends,
  buildDemandSignal,
  buildInsightsPrompt,
  shouldSkipManualInsights,
  type InsightsInputs,
} from "@/lib/accountInsights";
import {
  buildMediaEngagements,
  rankMedia,
  buildWeekdayPattern,
  buildTimeOfDayPattern,
  detectAnomalies,
} from "@/lib/analyticsSummary";
import { dailyHistory } from "@/lib/instagramPoller";

const INSIGHTS_WINDOW_DAYS = 90;

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runManualInsightsAction(params: { accountId: string }) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  // Validate the account exists BEFORE spending a paid Claude call — otherwise a
  // bad accountId would burn a request and only then fail on the FK insert.
  const account = await prisma.instagramAccount.findUnique({
    where: { id: params.accountId },
    select: { id: true },
  });
  if (!account) {
    throw new Error("Аккаунт не найден");
  }

  const now = new Date();
  const from = new Date(now.getTime() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const lastManualReport = await prisma.accountInsightReport.findFirst({
    where: { accountId: params.accountId, trigger: "manual" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (shouldSkipManualInsights(lastManualReport, now)) {
    throw new Error("Аккаунт уже разбирался меньше 5 минут назад");
  }

  const [media, accountSnapshots, leads] = await Promise.all([
    prisma.instagramMedia.findMany({
      where: { accountId: params.accountId, postedAt: { gte: from, lte: now } },
      select: { id: true, caption: true, mediaType: true, mediaProductType: true, postedAt: true },
    }),
    prisma.instagramMetricSnapshot.findMany({
      where: { accountId: params.accountId, scope: "account", capturedAt: { gte: from, lte: now } },
      select: { capturedAt: true, metrics: true },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: from, lte: now } },
      select: { destination: true },
    }),
  ]);

  const mediaSnapshots = await prisma.instagramMetricSnapshot.findMany({
    where: {
      accountId: params.accountId,
      mediaId: { in: media.map((item) => item.id) },
      scope: { in: ["media", "story"] },
    },
    select: { mediaId: true, capturedAt: true, metrics: true },
    orderBy: { capturedAt: "desc" },
  });
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

  const mediaEngagements = buildMediaEngagements(media, latestMetricsByMediaId);
  const { top, bottom } = rankMedia(mediaEngagements);
  const formatEngagements = buildMediaFormatEngagements(media, latestMetricsByMediaId);

  const inputs: InsightsInputs = {
    range: { from: formatDateOnly(from), to: formatDateOnly(now) },
    metricTrends: buildMetricTrends(dailyPoints),
    topMedia: top,
    bottomMedia: bottom,
    weekdayPattern: buildWeekdayPattern(mediaEngagements),
    timeOfDayPattern: buildTimeOfDayPattern(mediaEngagements),
    anomalies: detectAnomalies(dailyPoints),
    formatBreakdown: buildFormatBreakdown(formatEngagements),
    demandSignal: buildDemandSignal(leads),
  };

  const prompt = buildInsightsPrompt(inputs);
  const content = await analyzeAccountInsights(prompt);

  await prisma.accountInsightReport.create({
    data: {
      accountId: params.accountId,
      periodFrom: from,
      periodTo: now,
      trigger: "manual",
      content: content as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/panel/analytics");
}
