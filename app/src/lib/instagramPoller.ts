interface RawMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface RawComment {
  id: string;
  text?: string;
  username?: string;
  timestamp: string;
}

interface RawInsights {
  data: Array<{ name: string; values: Array<{ value: number }> }>;
}

interface RawBreakdownInsights {
  data?: unknown[];
}

// Which stored posts has Meta stopped returning, i.e. were deleted on Instagram? We only
// judge posts inside the window we actually saw: anything older than the oldest returned
// post may simply be past the pagination cap, not deleted. An empty response is treated as
// "saw nothing" (a transient API hiccup) rather than "everything is gone", so history is
// never mass-wiped on one flaky call.
export function selectDeletedMediaIds(params: {
  storedMedia: Array<{ instagramMediaId: string; postedAt: Date }>;
  returnedMedia: Array<{ instagramMediaId: string; postedAt: Date }>;
}): string[] {
  const { storedMedia, returnedMedia } = params;
  if (returnedMedia.length === 0) return [];

  const returnedIds = new Set(returnedMedia.map((m) => m.instagramMediaId));
  const oldestReturned = Math.min(...returnedMedia.map((m) => m.postedAt.getTime()));

  return storedMedia
    .filter((m) => m.postedAt.getTime() >= oldestReturned && !returnedIds.has(m.instagramMediaId))
    .map((m) => m.instagramMediaId);
}

export function normalizeMedia(raw: RawMedia, accountId: string) {
  return {
    instagramMediaId: String(raw.id),
    accountId,
    mediaType: raw.media_type,
    mediaProductType: raw.media_product_type ?? null,
    caption: raw.caption ?? null,
    permalink: raw.permalink ?? null,
    postedAt: new Date(raw.timestamp),
    likeCount: raw.like_count ?? 0,
    commentsCount: raw.comments_count ?? 0,
  };
}

export function normalizeComment(raw: RawComment, mediaId: string) {
  return {
    instagramCommentId: String(raw.id),
    mediaId,
    text: raw.text ?? "",
    username: raw.username ?? null,
    postedAt: new Date(raw.timestamp),
  };
}

export function flattenInsights(raw: RawInsights): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of raw.data ?? []) {
    const latest = item.values?.[item.values.length - 1];
    if (latest) result[item.name] = latest.value;
  }
  return result;
}

export function buildMetricSnapshot(params: {
  metrics: Record<string, unknown>;
  scope: "account" | "media" | "story" | "demographics";
  accountId: string;
  mediaId?: string | null;
  now?: Date;
}) {
  return {
    accountId: params.accountId,
    mediaId: params.mediaId ?? null,
    scope: params.scope,
    metrics: params.metrics,
    capturedAt: params.now ?? new Date(),
  };
}

export function isActiveStory(
  media: { mediaProductType: string | null; postedAt: Date },
  now: Date = new Date(),
): boolean {
  if (media.mediaProductType !== "STORY") return false;
  const ageMs = now.getTime() - media.postedAt.getTime();
  return ageMs < 24 * 60 * 60 * 1000;
}

const DEMOGRAPHICS_FOLLOWER_THRESHOLD = 100;

export function normalizeFollowerCount(raw: { followers_count?: number }): number {
  return raw.followers_count ?? 0;
}

export function shouldFetchDemographics(followerCount: number): boolean {
  return followerCount >= DEMOGRAPHICS_FOLLOWER_THRESHOLD;
}

export function buildDemographicsMetrics(params: {
  ageGender: RawBreakdownInsights;
  geography: RawBreakdownInsights;
}) {
  return {
    ageGender: params.ageGender.data ?? [],
    geography: params.geography.data ?? [],
  };
}

export function dailyHistory(
  snapshots: Array<{ capturedAt: Date; metrics: Record<string, unknown> }>,
): Array<{ date: string; metrics: Record<string, unknown> }> {
  const latestByDay = new Map<string, { capturedAt: Date; metrics: Record<string, unknown> }>();

  for (const snapshot of snapshots) {
    const date = snapshot.capturedAt.toISOString().slice(0, 10);
    const existing = latestByDay.get(date);
    if (!existing || snapshot.capturedAt.getTime() > existing.capturedAt.getTime()) {
      latestByDay.set(date, snapshot);
    }
  }

  return [...latestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, snapshot]) => ({ date, metrics: snapshot.metrics }));
}
