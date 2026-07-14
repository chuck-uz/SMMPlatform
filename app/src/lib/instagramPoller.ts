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
  metrics: Record<string, number>;
  scope: "account" | "media" | "story";
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
