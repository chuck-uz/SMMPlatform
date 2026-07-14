import type { Prisma } from "@/generated/prisma/client";

const TOKEN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_DAYS = 7;

const MEDIA_POLL_INTERVAL_MS = 15 * 60 * 1000;
const COMMENTS_POLL_INTERVAL_MS = 5 * 60 * 1000;
const METRICS_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000;
const STORY_METRICS_POLL_INTERVAL_MS = 60 * 60 * 1000;
const DIGEST_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const GROWTH_DIGEST_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const GROWTH_WINDOW_DAYS = 90;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { refreshAccountToken, daysUntilExpiry } = await import("@/lib/instagramOAuth");
  const { instagramApiClient } = await import("@/lib/instagramApiClient");
  const { instagramContentClient } = await import("@/lib/instagramContentClient");
  const {
    normalizeMedia,
    normalizeComment,
    flattenInsights,
    buildMetricSnapshot,
    isActiveStory,
    normalizeFollowerCount,
    shouldFetchDemographics,
    buildDemographicsMetrics,
    dailyHistory,
  } = await import("@/lib/instagramPoller");
  const { encrypt, decrypt } = await import("@/lib/encryption");
  const { resolvePeriodRange, buildPeriodSummary } = await import("@/lib/analyticsSummary");
  const { buildAnalysisPrompt, isDigestDue } = await import("@/lib/analysisReport");
  const { analyzeSummary } = await import("@/lib/claudeAnalysisClient");
  const {
    buildMediaFormatEngagements,
    buildFormatBreakdown,
    buildReachTrend,
    buildDemandSignal,
    buildGrowthPrompt,
    isGrowthDigestDue,
  } = await import("@/lib/growthInsights");
  const { analyzeGrowth } = await import("@/lib/claudeGrowthClient");

  async function refreshExpiringTokens() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const now = new Date();
    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      if (daysUntilExpiry(account.tokenExpiresAt, now) > REFRESH_THRESHOLD_DAYS) continue;

      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);
        const refreshed = await refreshAccountToken(accessToken, instagramApiClient, now);
        await prisma.instagramAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(refreshed.accessToken, encryptionKey),
            tokenExpiresAt: refreshed.tokenExpiresAt,
          },
        });
      } catch (error) {
        console.error(`[instagram-refresh] failed to refresh account ${account.id}`, error);
      }
    }
  }

  async function pollMedia() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);
        const rawMedia = await instagramContentClient.listMedia({ accessToken });

        for (const raw of rawMedia) {
          const media = normalizeMedia(raw, account.id);
          await prisma.instagramMedia.upsert({
            where: { instagramMediaId: media.instagramMediaId },
            create: media,
            update: {
              likeCount: media.likeCount,
              commentsCount: media.commentsCount,
              caption: media.caption,
              permalink: media.permalink,
            },
          });
        }
      } catch (error) {
        console.error(`[instagram-media-poll] failed for account ${account.id}`, error);
      }
    }
  }

  async function pollComments() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const accounts = await prisma.instagramAccount.findMany({ include: { media: true } });

    for (const account of accounts) {
      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);

        for (const media of account.media) {
          const rawComments = await instagramContentClient.listComments({
            accessToken,
            mediaId: media.instagramMediaId,
          });

          for (const raw of rawComments) {
            const comment = normalizeComment(raw, media.id);
            await prisma.instagramComment.upsert({
              where: { instagramCommentId: comment.instagramCommentId },
              create: comment,
              update: {},
            });
          }
        }
      } catch (error) {
        console.error(`[instagram-comments-poll] failed for account ${account.id}`, error);
      }
    }
  }

  async function pollMetrics() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const now = new Date();
    const accounts = await prisma.instagramAccount.findMany({ include: { media: true } });

    for (const account of accounts) {
      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);

        const accountInsights = await instagramContentClient.getAccountInsights({ accessToken });
        const profile = await instagramContentClient.getAccountProfile({ accessToken });
        const followerCount = normalizeFollowerCount(profile);

        await prisma.instagramMetricSnapshot.create({
          data: buildMetricSnapshot({
            metrics: { ...flattenInsights(accountInsights), followerCount },
            scope: "account",
            accountId: account.id,
            now,
          }) as Prisma.InstagramMetricSnapshotUncheckedCreateInput,
        });

        if (shouldFetchDemographics(followerCount)) {
          const demographics = await instagramContentClient.getAudienceDemographics({ accessToken });
          await prisma.instagramMetricSnapshot.create({
            data: buildMetricSnapshot({
              metrics: buildDemographicsMetrics(demographics),
              scope: "demographics",
              accountId: account.id,
              now,
            }) as Prisma.InstagramMetricSnapshotUncheckedCreateInput,
          });
        }

        for (const media of account.media) {
          if (media.mediaProductType === "STORY") continue;

          const mediaInsights = await instagramContentClient.getMediaInsights({
            accessToken,
            mediaId: media.instagramMediaId,
            mediaProductType: media.mediaProductType ?? "FEED",
          });
          await prisma.instagramMetricSnapshot.create({
            data: buildMetricSnapshot({
              metrics: flattenInsights(mediaInsights),
              scope: "media",
              accountId: account.id,
              mediaId: media.id,
              now,
            }) as Prisma.InstagramMetricSnapshotUncheckedCreateInput,
          });
        }
      } catch (error) {
        console.error(`[instagram-metrics-poll] failed for account ${account.id}`, error);
      }
    }
  }

  async function pollStoryMetrics() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const now = new Date();
    const accounts = await prisma.instagramAccount.findMany({ include: { media: true } });

    for (const account of accounts) {
      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);
        const activeStories = account.media.filter((media) =>
          isActiveStory({ mediaProductType: media.mediaProductType, postedAt: media.postedAt }, now),
        );

        for (const story of activeStories) {
          const insights = await instagramContentClient.getMediaInsights({
            accessToken,
            mediaId: story.instagramMediaId,
            mediaProductType: "STORY",
          });
          await prisma.instagramMetricSnapshot.create({
            data: buildMetricSnapshot({
              metrics: flattenInsights(insights),
              scope: "story",
              accountId: account.id,
              mediaId: story.id,
              now,
            }) as Prisma.InstagramMetricSnapshotUncheckedCreateInput,
          });
        }
      } catch (error) {
        console.error(`[instagram-story-metrics-poll] failed for account ${account.id}`, error);
      }
    }
  }

  async function runWeeklyDigest() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
    if (!claudeConfig?.verified) return;

    const now = new Date();
    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      try {
        const lastWeeklyReport = await prisma.aiAnalysisReport.findFirst({
          where: { accountId: account.id, trigger: "weekly" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (!isDigestDue(lastWeeklyReport, now)) continue;

        const range = resolvePeriodRange({ preset: "7d" }, now);

        const media = await prisma.instagramMedia.findMany({
          where: { accountId: account.id },
          select: { id: true, caption: true, mediaProductType: true, postedAt: true },
        });
        const [accountSnapshots, mediaSnapshots] = await Promise.all([
          prisma.instagramMetricSnapshot.findMany({
            where: { accountId: account.id, scope: "account" },
            select: { capturedAt: true, metrics: true },
            orderBy: { capturedAt: "asc" },
          }),
          prisma.instagramMetricSnapshot.findMany({
            where: {
              accountId: account.id,
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
            accountId: account.id,
            periodFrom: range.from,
            periodTo: range.to,
            trigger: "weekly",
            content: content as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        console.error(`[weekly-digest] failed for account ${account.id}`, error);
      }
    }
  }

  async function runGrowthDigest() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
    if (!claudeConfig?.verified) return;

    const now = new Date();
    const from = new Date(now.getTime() - GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      try {
        const lastDigestReport = await prisma.growthInsightReport.findFirst({
          where: { accountId: account.id, trigger: "digest" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (!isGrowthDigestDue(lastDigestReport, now)) continue;

        const [media, accountSnapshots, leads] = await Promise.all([
          prisma.instagramMedia.findMany({
            where: { accountId: account.id, postedAt: { gte: from, lte: now } },
            select: { id: true, mediaType: true, mediaProductType: true, postedAt: true },
          }),
          prisma.instagramMetricSnapshot.findMany({
            where: { accountId: account.id, scope: "account", capturedAt: { gte: from, lte: now } },
            select: { capturedAt: true, metrics: true },
            orderBy: { capturedAt: "asc" },
          }),
          prisma.lead.findMany({
            where: { createdAt: { gte: from, lte: now } },
            select: { destination: true },
          }),
        ]);

        const mediaSnapshots = await prisma.instagramMetricSnapshot.findMany({
          where: { accountId: account.id, mediaId: { in: media.map((item) => item.id) }, scope: "media" },
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

        const engagements = buildMediaFormatEngagements(media, latestMetricsByMediaId);
        const inputs = {
          range: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
          formatBreakdown: buildFormatBreakdown(engagements),
          reachTrend: buildReachTrend(dailyPoints),
          demandSignal: buildDemandSignal(leads),
        };

        const prompt = buildGrowthPrompt(inputs);
        const apiKey = decrypt(claudeConfig.encryptedApiKey, encryptionKey);
        const content = await analyzeGrowth(apiKey, prompt);

        await prisma.growthInsightReport.create({
          data: {
            accountId: account.id,
            periodFrom: from,
            periodTo: now,
            trigger: "digest",
            content: content as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        console.error(`[growth-digest] failed for account ${account.id}`, error);
      }
    }
  }

  setInterval(refreshExpiringTokens, TOKEN_CHECK_INTERVAL_MS);
  void refreshExpiringTokens();

  setInterval(pollMedia, MEDIA_POLL_INTERVAL_MS);
  void pollMedia();

  setInterval(pollComments, COMMENTS_POLL_INTERVAL_MS);
  void pollComments();

  setInterval(pollMetrics, METRICS_POLL_INTERVAL_MS);
  void pollMetrics();

  setInterval(pollStoryMetrics, STORY_METRICS_POLL_INTERVAL_MS);
  void pollStoryMetrics();

  setInterval(runWeeklyDigest, DIGEST_CHECK_INTERVAL_MS);
  void runWeeklyDigest();

  setInterval(runGrowthDigest, GROWTH_DIGEST_CHECK_INTERVAL_MS);
  void runGrowthDigest();
}
