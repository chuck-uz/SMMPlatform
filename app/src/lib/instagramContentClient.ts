import { InstagramApiError, parseGraphError } from "./instagramApiError";

const GRAPH_BASE = "https://graph.instagram.com";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count";
const COMMENT_FIELDS = "id,text,username,timestamp";

interface RawComment {
  id: string;
  text?: string;
  username?: string;
  timestamp: string;
}

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

// Follow paging.next up to this many pages. Bounds an otherwise-unbounded loop on
// pathological data; hitting the cap is logged so truncation is never silent.
const MAX_PAGES = 50;

const ACCOUNT_METRICS = "reach,profile_views,accounts_engaged,total_interactions,website_clicks";
const MEDIA_METRICS: Record<string, string> = {
  FEED: "reach,likes,comments,saved,shares,total_interactions",
  REELS: "reach,likes,comments,saved,shares,views,total_interactions",
  STORY: "reach,replies,taps_forward,taps_back,exits",
};

// A hung connection to Instagram must not stall a poller run indefinitely (which,
// combined with the fixed interval, would pile up overlapping runs).
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchJson(url: URL) {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Carry the parsed Graph error alongside the message so callers can tell a
    // permanent failure from a transient one without re-parsing the log line.
    throw new InstagramApiError(
      `Instagram content API request failed: ${res.status} ${url.pathname} ${body}`,
      { status: res.status, graphError: parseGraphError(body) },
    );
  }
  return res.json();
}

export const instagramContentClient = {
  async listMedia({ accessToken }: { accessToken: string }) {
    const url = new URL(`${GRAPH_BASE}/me/media`);
    url.searchParams.set("fields", MEDIA_FIELDS);
    url.searchParams.set("access_token", accessToken);

    // /me/media returns only the newest ~25 posts per page; without following
    // pagination, older posts are never ingested (missing from analytics and
    // never polled for comments).
    const media: RawMedia[] = [];
    let nextUrl: URL | null = url;
    let pageCount = 0;

    while (nextUrl && pageCount < MAX_PAGES) {
      const data = await fetchJson(nextUrl);
      media.push(...(data.data ?? []));
      nextUrl = data.paging?.next ? new URL(data.paging.next) : null;
      pageCount += 1;
    }
    if (nextUrl) {
      console.warn(`[instagram-content] listMedia hit the ${MAX_PAGES}-page cap; some older media were not ingested`);
    }

    return media;
  },

  async listComments({ accessToken, mediaId }: { accessToken: string; mediaId: string }) {
    const url = new URL(`${GRAPH_BASE}/${mediaId}/comments`);
    url.searchParams.set("fields", COMMENT_FIELDS);
    url.searchParams.set("access_token", accessToken);

    // A single page can miss the newest comment on posts with a large comment
    // history, so follow paging.next until exhausted (capped to avoid an
    // unbounded loop on pathological data).
    const comments: RawComment[] = [];
    let nextUrl: URL | null = url;
    let pageCount = 0;

    while (nextUrl && pageCount < MAX_PAGES) {
      const data = await fetchJson(nextUrl);
      comments.push(...(data.data ?? []));
      nextUrl = data.paging?.next ? new URL(data.paging.next) : null;
      pageCount += 1;
    }
    if (nextUrl) {
      console.warn(`[instagram-content] listComments for ${mediaId} hit the ${MAX_PAGES}-page cap; some comments were not fetched`);
    }

    return comments;
  },

  async getAccountInsights({ accessToken }: { accessToken: string }) {
    const url = new URL(`${GRAPH_BASE}/me/insights`);
    url.searchParams.set("metric", ACCOUNT_METRICS);
    url.searchParams.set("period", "day");
    url.searchParams.set("access_token", accessToken);
    return fetchJson(url);
  },

  async getAccountProfile({ accessToken }: { accessToken: string }) {
    const url = new URL(`${GRAPH_BASE}/me`);
    url.searchParams.set("fields", "followers_count");
    url.searchParams.set("access_token", accessToken);
    return fetchJson(url);
  },

  async getAudienceDemographics({ accessToken }: { accessToken: string }) {
    const ageGenderUrl = new URL(`${GRAPH_BASE}/me/insights`);
    ageGenderUrl.searchParams.set("metric", "follower_demographics");
    ageGenderUrl.searchParams.set("period", "lifetime");
    ageGenderUrl.searchParams.set("metric_type", "total_value");
    ageGenderUrl.searchParams.set("breakdown", "age,gender");
    ageGenderUrl.searchParams.set("access_token", accessToken);

    const geographyUrl = new URL(`${GRAPH_BASE}/me/insights`);
    geographyUrl.searchParams.set("metric", "follower_demographics");
    geographyUrl.searchParams.set("period", "lifetime");
    geographyUrl.searchParams.set("metric_type", "total_value");
    geographyUrl.searchParams.set("breakdown", "country");
    geographyUrl.searchParams.set("access_token", accessToken);

    const [ageGender, geography] = await Promise.all([
      fetchJson(ageGenderUrl),
      fetchJson(geographyUrl),
    ]);
    return { ageGender, geography };
  },

  async getMediaInsights({
    accessToken,
    mediaId,
    mediaProductType,
  }: {
    accessToken: string;
    mediaId: string;
    mediaProductType: string;
  }) {
    const metrics = MEDIA_METRICS[mediaProductType] ?? MEDIA_METRICS.FEED;
    const url = new URL(`${GRAPH_BASE}/${mediaId}/insights`);
    url.searchParams.set("metric", metrics);
    url.searchParams.set("access_token", accessToken);
    return fetchJson(url);
  },

  async postCommentReply({
    accessToken,
    commentId,
    message,
  }: {
    accessToken: string;
    commentId: string;
    message: string;
  }) {
    const url = new URL(`${GRAPH_BASE}/${commentId}/replies`);
    url.searchParams.set("message", message);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const detail = bodyText.trim().startsWith("<") ? "upstream returned an error page, not JSON" : bodyText.slice(0, 500);
      throw new InstagramApiError(
        `Instagram content API request failed: ${res.status} ${url.pathname} ${detail}`,
        { status: res.status, graphError: parseGraphError(bodyText) },
      );
    }
    return res.json();
  },
};
