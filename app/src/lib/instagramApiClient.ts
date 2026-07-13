import type { InstagramApiClient } from "./instagramOAuth";

export const instagramApiClient: InstagramApiClient = {
  async exchangeCodeForShortLivedToken({ code, appId, appSecret, redirectUri }) {
    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(`Instagram token exchange failed: ${res.status}`);
    const data = await res.json();
    return { accessToken: data.access_token, instagramUserId: String(data.user_id) };
  },

  async exchangeForLongLivedToken({ appSecret, shortLivedToken }) {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("access_token", shortLivedToken);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram long-lived token exchange failed: ${res.status}`);
    const data = await res.json();
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  },

  async refreshLongLivedToken({ accessToken }) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram token refresh failed: ${res.status}`);
    const data = await res.json();
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  },

  async getAccountInfo({ accessToken }) {
    const url = new URL("https://graph.instagram.com/me");
    url.searchParams.set("fields", "username");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram account info fetch failed: ${res.status}`);
    const data = await res.json();
    return { username: data.username };
  },
};
