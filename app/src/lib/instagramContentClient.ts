const GRAPH_BASE = "https://graph.instagram.com";
const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count";
const COMMENT_FIELDS = "id,text,username,timestamp";

const ACCOUNT_METRICS = "reach,profile_views,accounts_engaged,total_interactions,website_clicks";
const MEDIA_METRICS: Record<string, string> = {
  FEED: "reach,likes,comments,saved,shares,total_interactions",
  REELS: "reach,likes,comments,saved,shares,views,total_interactions",
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
};
