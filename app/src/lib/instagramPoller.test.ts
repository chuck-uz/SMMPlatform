import { describe, expect, it } from "vitest";
import {
  normalizeMedia,
  normalizeComment,
  flattenInsights,
  buildMetricSnapshot,
  isActiveStory,
} from "./instagramPoller";

describe("normalizeMedia", () => {
  it("maps a Graph API media object to a DB-ready record", () => {
    const raw = {
      id: "17895695668004550",
      caption: "Тур в Бухару",
      media_type: "IMAGE",
      media_product_type: "FEED",
      permalink: "https://instagram.com/p/abc",
      timestamp: "2026-07-10T12:00:00+0000",
      like_count: 42,
      comments_count: 5,
    };

    expect(normalizeMedia(raw, "account-1")).toEqual({
      instagramMediaId: "17895695668004550",
      accountId: "account-1",
      mediaType: "IMAGE",
      mediaProductType: "FEED",
      caption: "Тур в Бухару",
      permalink: "https://instagram.com/p/abc",
      postedAt: new Date("2026-07-10T12:00:00+0000"),
      likeCount: 42,
      commentsCount: 5,
    });
  });

  it("defaults missing optional fields", () => {
    const raw = { id: "1", media_type: "VIDEO", timestamp: "2026-07-10T12:00:00+0000" };

    const result = normalizeMedia(raw, "account-1");

    expect(result.caption).toBeNull();
    expect(result.permalink).toBeNull();
    expect(result.mediaProductType).toBeNull();
    expect(result.likeCount).toBe(0);
    expect(result.commentsCount).toBe(0);
  });
});

describe("normalizeComment", () => {
  it("maps a Graph API comment object to a DB-ready record", () => {
    const raw = {
      id: "17865860117993037",
      text: "Сколько стоит тур?",
      username: "aziza.uz",
      timestamp: "2026-07-10T13:00:00+0000",
    };

    expect(normalizeComment(raw, "media-1")).toEqual({
      instagramCommentId: "17865860117993037",
      mediaId: "media-1",
      text: "Сколько стоит тур?",
      username: "aziza.uz",
      postedAt: new Date("2026-07-10T13:00:00+0000"),
    });
  });

  it("defaults a missing username to null", () => {
    const raw = { id: "1", text: "hi", timestamp: "2026-07-10T13:00:00+0000" };

    expect(normalizeComment(raw, "media-1").username).toBeNull();
  });
});

describe("flattenInsights", () => {
  it("takes the latest value per metric from a Graph API insights response", () => {
    const raw = {
      data: [
        { name: "reach", values: [{ value: 100 }, { value: 120 }] },
        { name: "profile_views", values: [{ value: 30 }] },
      ],
    };

    expect(flattenInsights(raw)).toEqual({ reach: 120, profile_views: 30 });
  });

  it("returns an empty object for an empty response", () => {
    expect(flattenInsights({ data: [] })).toEqual({});
  });
});

describe("buildMetricSnapshot", () => {
  it("wraps flattened metrics with scope and capture time", () => {
    const now = new Date("2026-07-10T14:00:00Z");

    const snapshot = buildMetricSnapshot({
      metrics: { reach: 120 },
      scope: "account",
      accountId: "account-1",
      now,
    });

    expect(snapshot).toEqual({
      accountId: "account-1",
      mediaId: null,
      scope: "account",
      metrics: { reach: 120 },
      capturedAt: now,
    });
  });

  it("attaches a mediaId for media-scoped snapshots", () => {
    const snapshot = buildMetricSnapshot({
      metrics: { reach: 10 },
      scope: "media",
      accountId: "account-1",
      mediaId: "media-1",
      now: new Date("2026-07-10T14:00:00Z"),
    });

    expect(snapshot.mediaId).toBe("media-1");
  });
});

describe("isActiveStory", () => {
  const now = new Date("2026-07-10T14:00:00Z");

  it("is true for a story posted less than 24h ago", () => {
    const media = { mediaProductType: "STORY", postedAt: new Date("2026-07-10T10:00:00Z") };
    expect(isActiveStory(media, now)).toBe(true);
  });

  it("is false for a story posted more than 24h ago", () => {
    const media = { mediaProductType: "STORY", postedAt: new Date("2026-07-09T10:00:00Z") };
    expect(isActiveStory(media, now)).toBe(false);
  });

  it("is false for non-story media regardless of age", () => {
    const media = { mediaProductType: "FEED", postedAt: new Date("2026-07-10T10:00:00Z") };
    expect(isActiveStory(media, now)).toBe(false);
  });
});
