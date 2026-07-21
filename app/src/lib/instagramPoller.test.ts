import { describe, expect, it } from "vitest";
import {
  normalizeMedia,
  normalizeComment,
  flattenInsights,
  buildMetricSnapshot,
  isActiveStory,
  normalizeFollowerCount,
  shouldFetchDemographics,
  buildDemographicsMetrics,
  dailyHistory,
  selectDeletedMediaIds,
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

describe("normalizeFollowerCount", () => {
  it("reads followers_count from the account profile response", () => {
    expect(normalizeFollowerCount({ followers_count: 217 })).toBe(217);
  });

  it("defaults to 0 when missing", () => {
    expect(normalizeFollowerCount({})).toBe(0);
  });
});

describe("shouldFetchDemographics", () => {
  it("is true at or above the 100-follower threshold", () => {
    expect(shouldFetchDemographics(100)).toBe(true);
    expect(shouldFetchDemographics(217)).toBe(true);
  });

  it("is false below the threshold", () => {
    expect(shouldFetchDemographics(99)).toBe(false);
    expect(shouldFetchDemographics(0)).toBe(false);
  });
});

describe("buildDemographicsMetrics", () => {
  it("combines age/gender and geography insights responses", () => {
    const ageGender = { data: [{ name: "follower_demographics", values: [{ value: { "F.25-34": 12 } }] }] };
    const geography = { data: [{ name: "follower_demographics", values: [{ value: { UZ: 20 } }] }] };

    const result = buildDemographicsMetrics({ ageGender, geography });

    expect(result).toEqual({ ageGender: ageGender.data, geography: geography.data });
  });

  it("defaults to empty arrays when data is missing", () => {
    expect(buildDemographicsMetrics({ ageGender: {}, geography: {} })).toEqual({
      ageGender: [],
      geography: [],
    });
  });
});

describe("dailyHistory", () => {
  it("keeps only the latest snapshot per calendar day (UTC)", () => {
    const snapshots = [
      { capturedAt: new Date("2026-07-10T08:00:00Z"), metrics: { reach: 100 } },
      { capturedAt: new Date("2026-07-10T20:00:00Z"), metrics: { reach: 140 } },
      { capturedAt: new Date("2026-07-11T09:00:00Z"), metrics: { reach: 150 } },
    ];

    expect(dailyHistory(snapshots)).toEqual([
      { date: "2026-07-10", metrics: { reach: 140 } },
      { date: "2026-07-11", metrics: { reach: 150 } },
    ]);
  });

  it("returns an empty array for no snapshots", () => {
    expect(dailyHistory([])).toEqual([]);
  });

  it("sorts output ascending by date regardless of input order", () => {
    const snapshots = [
      { capturedAt: new Date("2026-07-12T08:00:00Z"), metrics: { reach: 1 } },
      { capturedAt: new Date("2026-07-10T08:00:00Z"), metrics: { reach: 2 } },
    ];

    expect(dailyHistory(snapshots).map((d) => d.date)).toEqual(["2026-07-10", "2026-07-12"]);
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

describe("selectDeletedMediaIds", () => {
  const at = (iso: string) => new Date(iso);
  const stored = [
    { instagramMediaId: "a", postedAt: at("2026-07-10T00:00:00Z") },
    { instagramMediaId: "b", postedAt: at("2026-07-09T00:00:00Z") },
    { instagramMediaId: "c", postedAt: at("2026-07-08T00:00:00Z") },
  ];

  it("returns a stored post that Meta no longer lists, within the returned window", () => {
    // Meta returned a and c; b sits between them in time, so it is inside the window
    // and its absence means it was deleted.
    const returned = [
      { instagramMediaId: "a", postedAt: at("2026-07-10T00:00:00Z") },
      { instagramMediaId: "c", postedAt: at("2026-07-08T00:00:00Z") },
    ];
    expect(selectDeletedMediaIds({ storedMedia: stored, returnedMedia: returned })).toEqual(["b"]);
  });

  it("never deletes a post older than the oldest one Meta returned (beyond the page cap)", () => {
    // Meta only returned a and b — c is older than the oldest returned (b) and may simply
    // be past the pagination cap, not deleted. It must be left alone.
    const returned = [
      { instagramMediaId: "a", postedAt: at("2026-07-10T00:00:00Z") },
      { instagramMediaId: "b", postedAt: at("2026-07-09T00:00:00Z") },
    ];
    expect(selectDeletedMediaIds({ storedMedia: stored, returnedMedia: returned })).toEqual([]);
  });

  it("returns nothing when every stored post is still listed", () => {
    const returned = stored.map((m) => ({ ...m }));
    expect(selectDeletedMediaIds({ storedMedia: stored, returnedMedia: returned })).toEqual([]);
  });

  it("returns nothing on an empty response — a transient hiccup must not wipe history", () => {
    expect(selectDeletedMediaIds({ storedMedia: stored, returnedMedia: [] })).toEqual([]);
  });

  it("deletes a post at the exact oldest-returned boundary", () => {
    // A stored post posted at the same instant as the oldest returned post, but absent
    // from the response, is inside the window (>=) and counts as deleted.
    const returned = [{ instagramMediaId: "a", postedAt: at("2026-07-08T00:00:00Z") }];
    const storedPair = [
      { instagramMediaId: "a", postedAt: at("2026-07-08T00:00:00Z") },
      { instagramMediaId: "d", postedAt: at("2026-07-08T00:00:00Z") },
    ];
    expect(selectDeletedMediaIds({ storedMedia: storedPair, returnedMedia: returned })).toEqual(["d"]);
  });
});
