const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

const TRACK_A_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

export interface InstagramOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface InstagramApiClient {
  exchangeCodeForShortLivedToken(params: {
    code: string;
    appId: string;
    appSecret: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; instagramUserId: string }>;
  exchangeForLongLivedToken(params: {
    appSecret: string;
    shortLivedToken: string;
  }): Promise<{ accessToken: string; expiresInSeconds: number }>;
  refreshLongLivedToken(params: { accessToken: string }): Promise<{
    accessToken: string;
    expiresInSeconds: number;
  }>;
  getAccountInfo(params: { accessToken: string }): Promise<{ username: string }>;
}

export function buildAuthorizeUrl(config: InstagramOAuthConfig & { state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TRACK_A_SCOPES.join(","));
  url.searchParams.set("state", config.state);
  return url.toString();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export async function connectInstagramAccount(
  code: string,
  config: InstagramOAuthConfig,
  client: Pick<
    InstagramApiClient,
    "exchangeCodeForShortLivedToken" | "exchangeForLongLivedToken" | "getAccountInfo"
  >,
  now: Date = new Date(),
) {
  const shortLived = await client.exchangeCodeForShortLivedToken({
    code,
    appId: config.appId,
    appSecret: config.appSecret,
    redirectUri: config.redirectUri,
  });

  const longLived = await client.exchangeForLongLivedToken({
    appSecret: config.appSecret,
    shortLivedToken: shortLived.accessToken,
  });

  const info = await client.getAccountInfo({ accessToken: longLived.accessToken });

  return {
    instagramUserId: shortLived.instagramUserId,
    username: info.username,
    accessToken: longLived.accessToken,
    tokenExpiresAt: addSeconds(now, longLived.expiresInSeconds),
  };
}

export async function refreshAccountToken(
  accessToken: string,
  client: Pick<InstagramApiClient, "refreshLongLivedToken">,
  now: Date = new Date(),
) {
  const refreshed = await client.refreshLongLivedToken({ accessToken });

  return {
    accessToken: refreshed.accessToken,
    tokenExpiresAt: addSeconds(now, refreshed.expiresInSeconds),
  };
}

export function daysUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  return Math.floor((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
