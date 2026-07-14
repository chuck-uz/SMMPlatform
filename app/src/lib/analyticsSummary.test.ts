import { describe, expect, it } from "vitest";
import {
  resolvePeriodRange,
  buildMetricDeltas,
  buildMediaEngagements,
  rankMedia,
  buildWeekdayPattern,
  buildTimeOfDayPattern,
  detectAnomalies,
  buildPeriodSummary,
} from "./analyticsSummary";

describe("resolvePeriodRange", () => {
  it("resolves a preset to [now - N days, now] and an equal-length previous period", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const range = resolvePeriodRange({ preset: "7d" }, now);

    expect(range.to).toEqual(now);
    expect(range.from).toEqual(new Date("2026-07-07T00:00:00Z"));
    expect(range.previousTo).toEqual(range.from);
    expect(range.previousFrom).toEqual(new Date("2026-06-30T00:00:00Z"));
  });

  it("resolves a custom range from explicit dates", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const range = resolvePeriodRange({ preset: "custom", from: "2026-07-01", to: "2026-07-10" }, now);

    expect(range.from).toEqual(new Date("2026-07-01"));
    expect(range.to).toEqual(new Date("2026-07-10"));
    expect(range.previousTo).toEqual(new Date("2026-07-01"));
  });

  it("falls back to the 7d preset if custom is selected without dates", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const range = resolvePeriodRange({ preset: "custom" }, now);

    expect(range.from).toEqual(new Date("2026-07-07T00:00:00Z"));
  });
});

describe("buildMetricDeltas", () => {
  it("sums flow metrics across the period and computes % change", () => {
    const current = [{ metrics: { reach: 100 } }, { metrics: { reach: 150 } }];
    const previous = [{ metrics: { reach: 100 } }, { metrics: { reach: 100 } }];

    const deltas = buildMetricDeltas(current, previous);
    const reach = deltas.find((d) => d.key === "reach");

    expect(reach).toEqual({ key: "reach", label: "Охват", current: 250, previous: 200, changePercent: 25 });
  });

  it("uses the last value (not sum) for the stock metric followerCount", () => {
    const current = [{ metrics: { followerCount: 200 } }, { metrics: { followerCount: 220 } }];
    const previous = [{ metrics: { followerCount: 180 } }, { metrics: { followerCount: 200 } }];

    const deltas = buildMetricDeltas(current, previous);
    const followers = deltas.find((d) => d.key === "followerCount");

    expect(followers).toEqual({ key: "followerCount", label: "Подписчики", current: 220, previous: 200, changePercent: 10 });
  });

  it("returns null changePercent when the previous value is 0", () => {
    const current = [{ metrics: { website_clicks: 5 } }];
    const previous = [{ metrics: { website_clicks: 0 } }];

    const deltas = buildMetricDeltas(current, previous);
    expect(deltas.find((d) => d.key === "website_clicks")?.changePercent).toBeNull();
  });
});

describe("buildMediaEngagements", () => {
  it("keeps only FEED and REELS, attaching total_interactions from the latest snapshot", () => {
    const media = [
      { id: "1", caption: "Post", mediaProductType: "FEED", postedAt: new Date("2026-07-10") },
      { id: "2", caption: "Reel", mediaProductType: "REELS", postedAt: new Date("2026-07-11") },
      { id: "3", caption: "Story", mediaProductType: "STORY", postedAt: new Date("2026-07-12") },
    ];
    const latestMetricsByMediaId = new Map([
      ["1", { total_interactions: 40 }],
      ["2", { total_interactions: 90 }],
      ["3", { replies: 2 }],
    ]);

    const result = buildMediaEngagements(media, latestMetricsByMediaId);

    expect(result).toEqual([
      { id: "1", caption: "Post", mediaProductType: "FEED", postedAt: new Date("2026-07-10"), totalInteractions: 40 },
      { id: "2", caption: "Reel", mediaProductType: "REELS", postedAt: new Date("2026-07-11"), totalInteractions: 90 },
    ]);
  });
});

describe("rankMedia", () => {
  it("ranks top 3 and bottom 3 by totalInteractions without overlap", () => {
    const engagements = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      caption: null,
      mediaProductType: "FEED",
      postedAt: new Date("2026-07-10"),
      totalInteractions: i * 10,
    }));

    const { top, bottom } = rankMedia(engagements);

    expect(top.map((e) => e.id)).toEqual(["7", "6", "5"]);
    expect(bottom.map((e) => e.id)).toEqual(["0", "1", "2"]);
  });

  it("returns an empty bottom list when there aren't enough items to avoid overlap with top", () => {
    const engagements = [
      { id: "a", caption: null, mediaProductType: "FEED", postedAt: new Date(), totalInteractions: 10 },
      { id: "b", caption: null, mediaProductType: "FEED", postedAt: new Date(), totalInteractions: 5 },
    ];

    const { top, bottom } = rankMedia(engagements);

    expect(top.map((e) => e.id)).toEqual(["a", "b"]);
    expect(bottom).toEqual([]);
  });
});

describe("buildWeekdayPattern", () => {
  it("only surfaces weekdays with at least 3 posts, ordered Mon..Sun", () => {
    const monday = (day: number) => new Date(`2026-06-${String(day).padStart(2, "0")}T10:00:00Z`); // 2026-06-01 is a Monday
    const engagements = [
      { id: "1", caption: null, mediaProductType: "FEED", postedAt: monday(1), totalInteractions: 10 },
      { id: "2", caption: null, mediaProductType: "FEED", postedAt: monday(8), totalInteractions: 20 },
      { id: "3", caption: null, mediaProductType: "FEED", postedAt: monday(15), totalInteractions: 30 },
      { id: "4", caption: null, mediaProductType: "FEED", postedAt: monday(2), totalInteractions: 5 },
    ];

    const pattern = buildWeekdayPattern(engagements);

    expect(pattern).toEqual([{ key: "1", label: "Пн", averageInteractions: 20, sampleSize: 3 }]);
  });
});

describe("buildTimeOfDayPattern", () => {
  it("buckets by hour of day and applies the same minimum-sample threshold", () => {
    const at = (hour: number) => new Date(`2026-07-10T${String(hour).padStart(2, "0")}:00:00Z`);
    const engagements = [
      { id: "1", caption: null, mediaProductType: "FEED", postedAt: at(8), totalInteractions: 10 },
      { id: "2", caption: null, mediaProductType: "FEED", postedAt: at(9), totalInteractions: 20 },
      { id: "3", caption: null, mediaProductType: "FEED", postedAt: at(10), totalInteractions: 30 },
      { id: "4", caption: null, mediaProductType: "FEED", postedAt: at(20), totalInteractions: 100 },
    ];

    const pattern = buildTimeOfDayPattern(engagements);

    expect(pattern).toEqual([{ key: "morning", label: "Утро (6–12)", averageInteractions: 20, sampleSize: 3 }]);
  });
});

describe("detectAnomalies", () => {
  it("flags a day that deviates from the period average by more than 50%", () => {
    const dailyPoints = [
      { date: "2026-07-10", metrics: { reach: 500 } },
      { date: "2026-07-11", metrics: { reach: 520 } },
      { date: "2026-07-12", metrics: { reach: 480 } },
      { date: "2026-07-13", metrics: { reach: 100 } },
    ];

    const anomalies = detectAnomalies(dailyPoints, ["reach"]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ metricKey: "reach", date: "2026-07-13" });
    expect(anomalies[0].changePercent).toBeLessThan(-50);
  });

  it("returns no anomalies with fewer than 4 data points", () => {
    const dailyPoints = [
      { date: "2026-07-10", metrics: { reach: 500 } },
      { date: "2026-07-11", metrics: { reach: 10 } },
    ];

    expect(detectAnomalies(dailyPoints, ["reach"])).toEqual([]);
  });
});

describe("buildPeriodSummary", () => {
  it("filters media to the period range before ranking and building time patterns", () => {
    const range = {
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-07-10T00:00:00Z"),
      previousFrom: new Date("2026-06-21T00:00:00Z"),
      previousTo: new Date("2026-07-01T00:00:00Z"),
    };
    const media = [
      { id: "in-range", caption: null, mediaProductType: "FEED", postedAt: new Date("2026-07-05") },
      { id: "out-of-range", caption: null, mediaProductType: "FEED", postedAt: new Date("2026-06-15") },
    ];
    const latestMetricsByMediaId = new Map([
      ["in-range", { total_interactions: 50 }],
      ["out-of-range", { total_interactions: 999 }],
    ]);

    const summary = buildPeriodSummary({
      range,
      currentPoints: [{ date: "2026-07-05", metrics: { reach: 100 } }],
      previousPoints: [{ metrics: { reach: 80 } }],
      media,
      latestMetricsByMediaId,
    });

    expect(summary.topMedia.map((m) => m.id)).toEqual(["in-range"]);
    expect(summary.range).toBe(range);
  });
});
