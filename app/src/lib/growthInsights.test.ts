import { describe, expect, it } from "vitest";
import {
  buildMediaFormatEngagements,
  buildFormatBreakdown,
  buildReachTrend,
  buildDemandSignal,
  buildGrowthPrompt,
  parseGrowthContent,
  shouldSkipManualGrowthAnalysis,
  isGrowthDigestDue,
  type GrowthInputs,
} from "./growthInsights";

describe("buildMediaFormatEngagements", () => {
  it("classifies REELS product type as reels regardless of mediaType", () => {
    const media = [{ id: "1", mediaType: "VIDEO", mediaProductType: "REELS", postedAt: new Date("2026-07-01T00:00:00Z") }];
    const metrics = new Map([["1", { total_interactions: 40 }]]);

    const result = buildMediaFormatEngagements(media, metrics);

    expect(result).toEqual([{ id: "1", format: "reels", totalInteractions: 40, postedAt: media[0].postedAt }]);
  });

  it("classifies CAROUSEL_ALBUM as carousel and IMAGE as photo", () => {
    const media = [
      { id: "1", mediaType: "CAROUSEL_ALBUM", mediaProductType: "FEED", postedAt: new Date("2026-07-01T00:00:00Z") },
      { id: "2", mediaType: "IMAGE", mediaProductType: "FEED", postedAt: new Date("2026-07-02T00:00:00Z") },
      { id: "3", mediaType: "VIDEO", mediaProductType: "FEED", postedAt: new Date("2026-07-03T00:00:00Z") },
    ];
    const metrics = new Map<string, Record<string, unknown>>();

    const result = buildMediaFormatEngagements(media, metrics);

    expect(result.map((r) => r.format)).toEqual(["carousel", "photo", "video"]);
  });

  it("defaults totalInteractions to 0 when no metrics snapshot exists", () => {
    const media = [{ id: "1", mediaType: "IMAGE", mediaProductType: "FEED", postedAt: new Date("2026-07-01T00:00:00Z") }];

    const result = buildMediaFormatEngagements(media, new Map());

    expect(result[0].totalInteractions).toBe(0);
  });
});

describe("buildFormatBreakdown", () => {
  it("excludes formats with fewer than 3 samples", () => {
    const engagements = [
      { id: "1", format: "reels" as const, totalInteractions: 10, postedAt: new Date() },
      { id: "2", format: "reels" as const, totalInteractions: 20, postedAt: new Date() },
      { id: "3", format: "photo" as const, totalInteractions: 5, postedAt: new Date() },
    ];

    const result = buildFormatBreakdown(engagements);

    expect(result).toEqual([]);
  });

  it("returns average interactions per format with enough samples, in fixed format order", () => {
    const engagements = [
      { id: "1", format: "photo" as const, totalInteractions: 10, postedAt: new Date() },
      { id: "2", format: "photo" as const, totalInteractions: 20, postedAt: new Date() },
      { id: "3", format: "photo" as const, totalInteractions: 30, postedAt: new Date() },
      { id: "4", format: "reels" as const, totalInteractions: 90, postedAt: new Date() },
      { id: "5", format: "reels" as const, totalInteractions: 90, postedAt: new Date() },
      { id: "6", format: "reels" as const, totalInteractions: 90, postedAt: new Date() },
    ];

    const result = buildFormatBreakdown(engagements);

    expect(result).toEqual([
      { format: "reels", label: "Reels", averageInteractions: 90, sampleSize: 3 },
      { format: "photo", label: "Фото", averageInteractions: 20, sampleSize: 3 },
    ]);
  });
});

describe("buildReachTrend", () => {
  it("reports insufficient data below the minimum point threshold", () => {
    const points = [
      { date: "2026-07-01", metrics: { reach: 100 } },
      { date: "2026-07-02", metrics: { reach: 100 } },
    ];

    const result = buildReachTrend(points);

    expect(result.sufficientData).toBe(false);
  });

  it("flags a decline when the second half drops more than 20% vs the first half", () => {
    const points = [
      { date: "2026-07-01", metrics: { reach: 100 } },
      { date: "2026-07-02", metrics: { reach: 100 } },
      { date: "2026-07-03", metrics: { reach: 100 } },
      { date: "2026-07-04", metrics: { reach: 50 } },
      { date: "2026-07-05", metrics: { reach: 50 } },
      { date: "2026-07-06", metrics: { reach: 50 } },
    ];

    const result = buildReachTrend(points);

    expect(result.sufficientData).toBe(true);
    expect(result.firstHalfAverage).toBe(100);
    expect(result.secondHalfAverage).toBe(50);
    expect(result.changePercent).toBe(-50);
    expect(result.isDeclining).toBe(true);
  });

  it("does not flag a decline under the threshold", () => {
    const points = [
      { date: "2026-07-01", metrics: { reach: 100 } },
      { date: "2026-07-02", metrics: { reach: 100 } },
      { date: "2026-07-03", metrics: { reach: 100 } },
      { date: "2026-07-04", metrics: { reach: 95 } },
      { date: "2026-07-05", metrics: { reach: 95 } },
      { date: "2026-07-06", metrics: { reach: 95 } },
    ];

    const result = buildReachTrend(points);

    expect(result.isDeclining).toBe(false);
  });
});

describe("buildDemandSignal", () => {
  it("marks demand signal unavailable when there are no leads", () => {
    expect(buildDemandSignal([])).toEqual({ available: false, destinationCounts: [] });
  });

  it("groups and ranks leads by destination, ignoring blank destinations", () => {
    const leads = [
      { destination: "Дубай" },
      { destination: "Дубай" },
      { destination: "Бали" },
      { destination: null },
      { destination: "  " },
    ];

    const result = buildDemandSignal(leads);

    expect(result).toEqual({
      available: true,
      destinationCounts: [
        { destination: "Дубай", count: 2 },
        { destination: "Бали", count: 1 },
      ],
    });
  });
});

function buildInputs(overrides: Partial<GrowthInputs> = {}): GrowthInputs {
  return {
    range: { from: "2026-04-16", to: "2026-07-14" },
    formatBreakdown: [{ format: "reels", label: "Reels", averageInteractions: 90, sampleSize: 5 }],
    reachTrend: { firstHalfAverage: 100, secondHalfAverage: 50, changePercent: -50, isDeclining: true, sufficientData: true },
    demandSignal: { available: false, destinationCounts: [] },
    ...overrides,
  };
}

describe("buildGrowthPrompt", () => {
  it("embeds the period range and serialized inputs as JSON", () => {
    const prompt = buildGrowthPrompt(buildInputs());

    expect(prompt).toContain("2026-04-16 — 2026-07-14");
    expect(prompt).toContain('"averageInteractions": 90');
  });

  it("tells the model demand data is unavailable when the demand signal is unavailable", () => {
    const prompt = buildGrowthPrompt(buildInputs({ demandSignal: { available: false, destinationCounts: [] } }));

    expect(prompt).toContain("данных о заявках пока нет");
  });
});

describe("parseGrowthContent", () => {
  it("accepts a well-formed structured response", () => {
    const raw = {
      bottlenecks: ["Reels стабильно опережают фото по вовлечённости."],
      direction: "Сфокусироваться на Reels-формате.",
      growthPriorities: ["Публиковать больше Reels."],
    };

    expect(parseGrowthContent(raw)).toEqual(raw);
  });

  it("rejects a response missing required fields or with wrong types", () => {
    expect(parseGrowthContent({ direction: "..." })).toBeNull();
    expect(parseGrowthContent({ bottlenecks: [1], direction: "...", growthPriorities: [] })).toBeNull();
    expect(parseGrowthContent(null)).toBeNull();
    expect(parseGrowthContent("not an object")).toBeNull();
  });
});

describe("shouldSkipManualGrowthAnalysis", () => {
  it("skips when the last manual report is under 5 minutes old", () => {
    const now = new Date("2026-07-14T12:05:00Z");
    expect(shouldSkipManualGrowthAnalysis({ createdAt: new Date("2026-07-14T12:02:00Z") }, now)).toBe(true);
  });

  it("allows a new analysis once 5 minutes have passed", () => {
    const now = new Date("2026-07-14T12:10:00Z");
    expect(shouldSkipManualGrowthAnalysis({ createdAt: new Date("2026-07-14T12:02:00Z") }, now)).toBe(false);
  });

  it("allows analysis when there is no prior report", () => {
    expect(shouldSkipManualGrowthAnalysis(null, new Date())).toBe(false);
  });
});

describe("isGrowthDigestDue", () => {
  it("is not due before 30 days have passed", () => {
    const now = new Date("2026-07-30T00:00:00Z");
    expect(isGrowthDigestDue({ createdAt: new Date("2026-07-01T00:00:00Z") }, now)).toBe(false);
  });

  it("is due once 30 days have passed", () => {
    const now = new Date("2026-07-31T00:00:00Z");
    expect(isGrowthDigestDue({ createdAt: new Date("2026-07-01T00:00:00Z") }, now)).toBe(true);
  });

  it("is due when there is no prior digest report", () => {
    expect(isGrowthDigestDue(null, new Date())).toBe(true);
  });
});
