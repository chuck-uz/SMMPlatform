const GRAPH_BASE = "https://graph.instagram.com";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count";
const COMMENT_FIELDS = "id,text,username,timestamp";

const ACCOUNT_METRICS = "reach,profile_views,accounts_engaged,total_interactions";
const MEDIA_METRICS: Record<string, string> = {
  FEED: "reach,likes,comments,saved,shares,total_interactions",
  REELS: "reach,likes,comments,saved,shares,plays,total_interactions",
  STORY: "reach,replies,taps_forward,taps_back,exits",
};

async function fetchJson(url: URL) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Instagram content API request failed: ${res.status} ${url.pathname} ${body}`);
  }
  return res.json();
}

export const instagramContentClient = {
  async listMedia({ accessToken }: { accessToken: string }) {
    const url = new URL(`${GRAPH_BASE}/me/media`);
    url.searchParams.set("fields", MEDIA_FIELDS);
    url.searchParams.set("access_token", accessToken);
    const data = await fetchJson(url);
    return data.data ?? [];
  },

  async listComments({ accessToken, mediaId }: { accessToken: string; mediaId: string }) {
    const url = new URL(`${GRAPH_BASE}/${mediaId}/comments`);
    url.searchParams.set("fields", COMMENT_FIELDS);
    url.searchParams.set("access_token", accessToken);
    const data = await fetchJson(url);
    return data.data ?? [];
  },

  async getAccountInsights({ accessToken }: { accessToken: string }) {
    const url = new URL(`${GRAPH_BASE}/me/insights`);
    url.searchParams.set("metric", ACCOUNT_METRICS);
    url.searchParams.set("period", "day");
    url.searchParams.set("access_token", accessToken);
    return fetchJson(url);
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
};
