import { describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  connectInstagramAccount,
  refreshAccountToken,
  daysUntilExpiry,
} from "./instagramOAuth";

const CONFIG = {
  appId: "app-123",
  appSecret: "secret-abc",
  redirectUri: "https://smm.oresh.in/api/instagram/callback",
};

describe("buildAuthorizeUrl", () => {
  it("builds the Instagram OAuth authorize URL with Track A scopes only", () => {
    const url = buildAuthorizeUrl({ ...CONFIG, state: "csrf-token" });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("app-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("csrf-token");
    expect(parsed.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_insights",
    );
  });
});

describe("connectInstagramAccount", () => {
  it("exchanges code for short-lived, then long-lived token, and fetches account info", async () => {
    const client = {
      exchangeCodeForShortLivedToken: vi.fn().mockResolvedValue({
        accessToken: "short-lived-token",
        instagramUserId: "ig-user-1",
      }),
      exchangeForLongLivedToken: vi.fn().mockResolvedValue({
        accessToken: "long-lived-token",
        expiresInSeconds: 60 * 24 * 60 * 60,
      }),
      getAccountInfo: vi.fn().mockResolvedValue({ username: "tourbot" }),
    };

    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = await connectInstagramAccount("auth-code", CONFIG, client, now);

    expect(client.exchangeCodeForShortLivedToken).toHaveBeenCalledWith({
      code: "auth-code",
      appId: CONFIG.appId,
      appSecret: CONFIG.appSecret,
      redirectUri: CONFIG.redirectUri,
    });
    expect(client.exchangeForLongLivedToken).toHaveBeenCalledWith({
      appSecret: CONFIG.appSecret,
      shortLivedToken: "short-lived-token",
    });
    expect(client.getAccountInfo).toHaveBeenCalledWith({ accessToken: "long-lived-token" });

    expect(result).toEqual({
      instagramUserId: "ig-user-1",
      username: "tourbot",
      accessToken: "long-lived-token",
      tokenExpiresAt: new Date("2026-03-02T00:00:00.000Z"),
    });
  });
});

describe("refreshAccountToken", () => {
  it("refreshes the long-lived token and computes the new expiry", async () => {
    const client = {
      refreshLongLivedToken: vi.fn().mockResolvedValue({
        accessToken: "refreshed-token",
        expiresInSeconds: 60 * 24 * 60 * 60,
      }),
    };

    const now = new Date("2026-02-01T00:00:00.000Z");
    const result = await refreshAccountToken("old-token", client, now);

    expect(client.refreshLongLivedToken).toHaveBeenCalledWith({ accessToken: "old-token" });
    expect(result).toEqual({
      accessToken: "refreshed-token",
      tokenExpiresAt: new Date("2026-04-02T00:00:00.000Z"),
    });
  });
});

describe("daysUntilExpiry", () => {
  it("returns the number of whole days remaining", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-08T00:00:00.000Z");

    expect(daysUntilExpiry(expiresAt, now)).toBe(7);
  });

  it("rounds down partial days", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-08T23:00:00.000Z");

    expect(daysUntilExpiry(expiresAt, now)).toBe(7);
  });

  it("returns a negative number for an already-expired token", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const expiresAt = new Date("2026-01-08T00:00:00.000Z");

    expect(daysUntilExpiry(expiresAt, now)).toBe(-2);
  });
});
