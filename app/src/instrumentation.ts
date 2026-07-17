import type { Prisma } from "@/generated/prisma/client";

const TOKEN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_DAYS = 7;

const MEDIA_POLL_INTERVAL_MS = 15 * 60 * 1000;
// Временно 1 мин для финальной проверки CM1 после свежего гранта scope (вернуть к 5 мин).
const COMMENTS_POLL_INTERVAL_MS = 1 * 60 * 1000;
const METRICS_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000;
const STORY_METRICS_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INSIGHTS_DIGEST_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INSIGHTS_WINDOW_DAYS = 90;

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
  const {
    buildMediaEngagements,
    rankMedia,
    buildWeekdayPattern,
    buildTimeOfDayPattern,
    detectAnomalies,
  } = await import("@/lib/analyticsSummary");
  const {
    buildMediaFormatEngagements,
    buildFormatBreakdown,
    buildMetricTrends,
    buildDemandSignal,
    buildInsightsPrompt,
    isInsightsDigestDue,
  } = await import("@/lib/accountInsights");
  const { analyzeAccountInsights } = await import("@/lib/claudeInsightsClient");
  const { buildCommentReplySystemPrompt, buildCommentUserMessage } = await import("@/lib/commentReply");
  const { generateCommentReply } = await import("@/lib/commentReplyClient");

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
    const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
    const agentConfig = await prisma.agentConfig.findUnique({ where: { singleton: "agent" } });
    const knowledgeDocuments = await prisma.agentKnowledgeDocument.findMany({
      select: { title: true, body: true },
    });
    const canAutoReply = Boolean(claudeConfig?.verified && agentConfig);

    for (const account of accounts) {
      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);

        for (const media of account.media) {
          // Isolate each media: one deleted/broken post must not abort polling of
          // the account's remaining posts (its listComments would throw every tick).
          try {
            const rawComments = await instagramContentClient.listComments({
              accessToken,
              mediaId: media.instagramMediaId,
            });

            // DIAG (временно): сырое число комментов от Meta по медиа — финальная проверка после свежего гранта scope.
            console.log(`[comments-poll][DIAG] media ${media.instagramMediaId}: ${rawComments.length} raw comments`);

            for (const raw of rawComments) {
              const comment = normalizeComment(raw, media.id);

              let created;
              try {
                created = await prisma.instagramComment.create({ data: comment });
              } catch (error) {
                // P2002 unique constraint — comment already seen on a previous poll, nothing to do.
                if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") {
                  continue;
                }
                throw error;
              }

              // Ingestion baseline: never draft/reply to the historical backlog that
              // predates connecting the account, and never reply to the account's own
              // comments. Such rows are recorded but parked as "skipped".
              const isBacklog = created.postedAt < account.createdAt;
              const isSelfComment = created.username != null && created.username === account.username;
              if (isBacklog || isSelfComment) {
                await prisma.instagramComment.update({
                  where: { id: created.id },
                  data: { replyStatus: "skipped" },
                });
                continue;
              }

              if (!canAutoReply || !claudeConfig || !agentConfig) continue;

              try {
                const apiKey = decrypt(claudeConfig.encryptedApiKey, encryptionKey);
                const systemPrompt = buildCommentReplySystemPrompt({
                  commentToneAndRules: agentConfig.commentToneAndRules,
                  knowledgeDocuments,
                });
                const userMessage = buildCommentUserMessage({ text: created.text, username: created.username });
                const { reply } = await generateCommentReply(apiKey, systemPrompt, userMessage);

                if (agentConfig.commentModerationEnabled) {
                  await prisma.instagramComment.update({
                    where: { id: created.id },
                    data: { draftReply: reply, replyStatus: "draft_ready" },
                  });
                } else {
                  const posted = await instagramContentClient.postCommentReply({
                    accessToken,
                    commentId: created.instagramCommentId,
                    message: reply,
                  });
                  await prisma.instagramComment.update({
                    where: { id: created.id },
                    data: {
                      draftReply: reply,
                      replyStatus: "sent",
                      repliedAt: new Date(),
                      sentReplyId: typeof posted?.id === "string" ? posted.id : null,
                    },
                  });
                }
              } catch (error) {
                console.error(`[instagram-comments-poll] reply failed for comment ${created.id}`, error);
                await prisma.instagramComment.update({
                  where: { id: created.id },
                  data: { replyStatus: "failed" },
                });
              }
            }
          } catch (error) {
            console.error(`[instagram-comments-poll] failed for media ${media.instagramMediaId}`, error);
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

          // Isolate each media: a deleted post throws on getMediaInsights every tick;
          // that must not abort metric snapshots for the account's other media.
          try {
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
          } catch (error) {
            console.error(`[instagram-metrics-poll] failed for media ${media.instagramMediaId}`, error);
          }
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

  async function runInsightsDigest() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
    if (!claudeConfig?.verified) return;

    const now = new Date();
    const from = new Date(now.getTime() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      try {
        const lastDigestReport = await prisma.accountInsightReport.findFirst({
          where: { accountId: account.id, trigger: "digest" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (!isInsightsDigestDue(lastDigestReport, now)) continue;

        const [media, accountSnapshots, leads] = await Promise.all([
          prisma.instagramMedia.findMany({
            where: { accountId: account.id, postedAt: { gte: from, lte: now } },
            select: { id: true, caption: true, mediaType: true, mediaProductType: true, postedAt: true },
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
          where: {
            accountId: account.id,
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

        const inputs = {
          range: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
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
        const apiKey = decrypt(claudeConfig.encryptedApiKey, encryptionKey);
        const content = await analyzeAccountInsights(apiKey, prompt);

        await prisma.accountInsightReport.create({
          data: {
            accountId: account.id,
            periodFrom: from,
            periodTo: now,
            trigger: "digest",
            content: content as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        console.error(`[insights-digest] failed for account ${account.id}`, error);
      }
    }
  }

  // Prevent overlapping runs: a poller whose run outlasts its interval must not
  // start a second concurrent run (which would double Instagram API traffic and
  // pile up unbounded). A run is skipped while its previous one is still in flight.
  function scheduleGuarded(fn: () => Promise<void>, intervalMs: number) {
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      void fn().finally(() => {
        running = false;
      });
    };
    setInterval(run, intervalMs);
    run();
  }

  scheduleGuarded(refreshExpiringTokens, TOKEN_CHECK_INTERVAL_MS);
  scheduleGuarded(pollMedia, MEDIA_POLL_INTERVAL_MS);
  scheduleGuarded(pollComments, COMMENTS_POLL_INTERVAL_MS);
  scheduleGuarded(pollMetrics, METRICS_POLL_INTERVAL_MS);
  scheduleGuarded(pollStoryMetrics, STORY_METRICS_POLL_INTERVAL_MS);
  scheduleGuarded(runInsightsDigest, INSIGHTS_DIGEST_CHECK_INTERVAL_MS);
}
