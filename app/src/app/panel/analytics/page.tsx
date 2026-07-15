import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dailyHistory } from "@/lib/instagramPoller";
import {
  buildAccountMetricCharts,
  buildMediaTableRows,
  parseAgeGenderBreakdown,
  parseGeographyBreakdown,
} from "@/lib/analyticsDashboard";
import {
  buildMediaEngagements,
  rankMedia,
  buildWeekdayPattern,
  buildTimeOfDayPattern,
  detectAnomalies,
} from "@/lib/analyticsSummary";
import {
  buildMediaFormatEngagements,
  buildFormatBreakdown,
  buildMetricTrends,
  buildDemandSignal,
} from "@/lib/accountInsights";
import { AccountSelector } from "@/components/AccountSelector";
import { ANALYTICS_TABS, AnalyticsTabs } from "@/components/AnalyticsTabs";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { MediaTable } from "@/components/MediaTable";
import { DemographicsBlock } from "@/components/DemographicsBlock";
import { AccountInsightsPanel } from "@/components/AccountInsightsPanel";
import { AccountInsightsTrigger } from "@/components/AccountInsightsTrigger";
import { AccountInsightsList } from "@/components/AccountInsightsList";
import type { InsightsContent } from "@/lib/accountInsights";

const INSIGHTS_WINDOW_DAYS = 90;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; tab?: string }>;
}) {
  const { account: accountParam, tab: tabParam } = await searchParams;
  const activeTab = ANALYTICS_TABS.some((tab) => tab.value === tabParam) ? (tabParam as string) : "overview";

  const accounts = await prisma.instagramAccount.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true },
  });

  if (accounts.length === 0) {
    return (
      <div className="p-6 sm:p-8 sm:px-10">
        <div className="max-w-[640px] rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
          Пока нет подключённых аккаунтов Instagram — подключите аккаунт на странице «Подключения»,
          чтобы увидеть аналитику.
        </div>
      </div>
    );
  }

  const selectedAccount =
    accounts.find((account) => account.id === accountParam) ?? accounts[0];

  const now = new Date();
  const windowStart = new Date(now.getTime() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const media = await prisma.instagramMedia.findMany({
    where: { accountId: selectedAccount.id },
    orderBy: { postedAt: "desc" },
    select: {
      id: true,
      mediaType: true,
      mediaProductType: true,
      caption: true,
      permalink: true,
      postedAt: true,
      likeCount: true,
      commentsCount: true,
    },
  });

  const mediaIds = media.map((item) => item.id);

  const [accountSnapshots, mediaSnapshots, demographicsSnapshot, insightReports] = await Promise.all([
    prisma.instagramMetricSnapshot.findMany({
      where: { accountId: selectedAccount.id, scope: "account" },
      select: { capturedAt: true, metrics: true },
      orderBy: { capturedAt: "asc" },
    }),
    // Only the latest snapshot per media, not the entire history — DISTINCT ON
    // (backed by the (mediaId) index) instead of scanning every row and deduping
    // in JS, which grows unbounded as snapshots accumulate.
    mediaIds.length === 0
      ? Promise.resolve([] as Array<{ mediaId: string; metrics: unknown }>)
      : prisma.$queryRaw<Array<{ mediaId: string; metrics: unknown }>>`
          SELECT DISTINCT ON ("mediaId") "mediaId", "metrics"
          FROM "instagram_metric_snapshots"
          WHERE "accountId" = ${selectedAccount.id}
            AND "scope" IN ('media', 'story')
            AND "mediaId" IN (${Prisma.join(mediaIds)})
          ORDER BY "mediaId", "capturedAt" DESC
        `,
    prisma.instagramMetricSnapshot.findFirst({
      where: { accountId: selectedAccount.id, scope: "demographics" },
      select: { metrics: true },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.accountInsightReport.findMany({
      where: { accountId: selectedAccount.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, trigger: true, periodFrom: true, periodTo: true, createdAt: true, content: true },
    }),
  ]);

  const latestMetricsByMediaId = new Map<string, Record<string, unknown>>();
  for (const snapshot of mediaSnapshots) {
    if (snapshot.mediaId) {
      latestMetricsByMediaId.set(snapshot.mediaId, snapshot.metrics as Record<string, unknown>);
    }
  }

  const dailyPoints = dailyHistory(
    accountSnapshots.map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      metrics: snapshot.metrics as Record<string, unknown>,
    })),
  );
  const charts = buildAccountMetricCharts(dailyPoints);
  const mediaRows = buildMediaTableRows(media, latestMetricsByMediaId);

  const followerCount =
    dailyPoints.length > 0
      ? ((dailyPoints[dailyPoints.length - 1].metrics as Record<string, number>).followerCount ?? null)
      : null;
  const demographicsMetrics = demographicsSnapshot?.metrics as
    | { ageGender?: unknown[]; geography?: unknown[] }
    | undefined;
  const ageGender = parseAgeGenderBreakdown(demographicsMetrics?.ageGender ?? []);
  const countries = parseGeographyBreakdown(demographicsMetrics?.geography ?? []);

  const windowMedia = media.filter((item) => item.postedAt >= windowStart && item.postedAt <= now);
  const windowDailyPoints = dailyPoints.filter((point) => {
    const date = new Date(point.date);
    return date >= windowStart && date <= now;
  });
  const mediaEngagements = buildMediaEngagements(windowMedia, latestMetricsByMediaId);
  const { top, bottom } = rankMedia(mediaEngagements);
  const formatEngagements = buildMediaFormatEngagements(windowMedia, latestMetricsByMediaId);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: windowStart, lte: now } },
    select: { destination: true },
  });

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
        <p className="min-w-0 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
          Динамика аккаунта по дням, публикации и демография аудитории — на основе данных,
          собранных фоновым опросом Instagram.
        </p>
        <AccountSelector accounts={accounts} selectedAccountId={selectedAccount.id} />
      </div>

      <AnalyticsTabs activeTab={activeTab} accountId={selectedAccount.id} />

      {activeTab === "overview" && (
        <>
          <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Динамика</h2>
          <div className="mt-3 max-w-[1020px]">
            <AnalyticsCharts charts={charts} />
          </div>

          <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Демография аудитории</h2>
          <div className="mt-3 max-w-[1020px]">
            <DemographicsBlock followerCount={followerCount} ageGender={ageGender} countries={countries} />
          </div>
        </>
      )}

      {activeTab === "posts" && (
        <div className="mt-8 max-w-[1020px]">
          <MediaTable rows={mediaRows} />
        </div>
      )}

      {activeTab === "ai" && (
        <>
          <p className="mt-8 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
            Метрики, публикации, паттерны и аномалии считаются автоматически за фиксированное
            90-дневное окно. Claude разбирает эти данные целиком — общая картина, наблюдения,
            пробелы, направление развития и приоритизированные рекомендации — и делает это
            заново по кнопке или раз в неделю.
          </p>

          <h2 className="mt-6 text-[13.5px] font-semibold text-foreground">Данные за 90 дней</h2>
          <div className="mt-3 max-w-[1020px]">
            <AccountInsightsPanel
              metricTrends={buildMetricTrends(windowDailyPoints)}
              topMedia={top}
              bottomMedia={bottom}
              weekdayPattern={buildWeekdayPattern(mediaEngagements)}
              timeOfDayPattern={buildTimeOfDayPattern(mediaEngagements)}
              anomalies={detectAnomalies(windowDailyPoints)}
              formatBreakdown={buildFormatBreakdown(formatEngagements)}
              demandSignal={buildDemandSignal(leads)}
            />
          </div>

          <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">AI-разбор</h2>
          <div className="mt-3">
            <AccountInsightsTrigger accountId={selectedAccount.id} />
          </div>
          <div className="mt-4 max-w-[1020px]">
            <AccountInsightsList
              reports={insightReports.map((report) => ({
                ...report,
                content: report.content as unknown as InsightsContent,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
