import { describe, expect, it } from "vitest";
import {
  buildMediaEngagements,
  rankMedia,
  buildWeekdayPattern,
  buildTimeOfDayPattern,
  detectAnomalies,
} from "./analyticsSummary";

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
