import { prisma } from "@/lib/prisma";
import { dailyHistory } from "@/lib/instagramPoller";
import {
  buildAccountMetricCharts,
  buildMediaTableRows,
  parseAgeGenderBreakdown,
  parseGeographyBreakdown,
} from "@/lib/analyticsDashboard";
import { AccountSelector } from "@/components/AccountSelector";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { MediaTable } from "@/components/MediaTable";
import { DemographicsBlock } from "@/components/DemographicsBlock";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: accountParam } = await searchParams;

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

  const [accountSnapshots, mediaSnapshots, demographicsSnapshot] = await Promise.all([
    prisma.instagramMetricSnapshot.findMany({
      where: { accountId: selectedAccount.id, scope: "account" },
      select: { capturedAt: true, metrics: true },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.instagramMetricSnapshot.findMany({
      where: {
        accountId: selectedAccount.id,
        mediaId: { in: media.map((item) => item.id) },
        scope: { in: ["media", "story"] },
      },
      select: { mediaId: true, capturedAt: true, metrics: true },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.instagramMetricSnapshot.findFirst({
      where: { accountId: selectedAccount.id, scope: "demographics" },
      select: { metrics: true },
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

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
        <p className="min-w-0 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
          Динамика аккаунта по дням, публикации и демография аудитории — на основе данных,
          собранных фоновым опросом Instagram.
        </p>
        <AccountSelector accounts={accounts} selectedAccountId={selectedAccount.id} />
      </div>

      <h2 className="mt-8 text-[13.5px] font-semibold text-foreground">Динамика</h2>
      <div className="mt-3 max-w-[1020px]">
        <AnalyticsCharts charts={charts} />
      </div>

      <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Публикации</h2>
      <div className="mt-3 max-w-[1020px]">
        <MediaTable rows={mediaRows} />
      </div>

      <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Демография аудитории</h2>
      <div className="mt-3 max-w-[1020px]">
        <DemographicsBlock followerCount={followerCount} ageGender={ageGender} countries={countries} />
      </div>
    </div>
  );
}
