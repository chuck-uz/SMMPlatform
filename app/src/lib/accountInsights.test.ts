import { describe, expect, it } from "vitest";
import {
  buildMediaFormatEngagements,
  buildFormatBreakdown,
  buildMetricTrends,
  buildDemandSignal,
  buildInsightsPrompt,
  parseInsightsContent,
  shouldSkipManualInsights,
  isInsightsDigestDue,
  type InsightsInputs,
} from "./accountInsights";

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
});

describe("buildFormatBreakdown", () => {
  it("excludes formats with fewer than 3 samples", () => {
    const engagements = [
      { id: "1", format: "reels" as const, totalInteractions: 10, postedAt: new Date() },
      { id: "2", format: "reels" as const, totalInteractions: 20, postedAt: new Date() },
      { id: "3", format: "photo" as const, totalInteractions: 5, postedAt: new Date() },
    ];

    expect(buildFormatBreakdown(engagements)).toEqual([]);
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

    expect(buildFormatBreakdown(engagements)).toEqual([
      { format: "reels", label: "Reels", averageInteractions: 90, sampleSize: 3 },
      { format: "photo", label: "Фото", averageInteractions: 20, sampleSize: 3 },
    ]);
  });
});

describe("buildMetricTrends", () => {
  it("reports insufficient data below the minimum point threshold", () => {
    const points = [
      { date: "2026-07-01", metrics: { reach: 100 } },
      { date: "2026-07-02", metrics: { reach: 100 } },
    ];

    expect(buildMetricTrends(points)).toEqual({ sufficientData: false, metrics: [] });
  });

  it("uses the last value (not average) for the stock metric followerCount", () => {
    const points = [
      { date: "2026-07-01", metrics: { followerCount: 100 } },
      { date: "2026-07-02", metrics: { followerCount: 110 } },
      { date: "2026-07-03", metrics: { followerCount: 120 } },
      { date: "2026-07-04", metrics: { followerCount: 130 } },
      { date: "2026-07-05", metrics: { followerCount: 140 } },
      { date: "2026-07-06", metrics: { followerCount: 150 } },
    ];

    const result = buildMetricTrends(points);
    const followers = result.metrics.find((m) => m.key === "followerCount");

    expect(followers).toMatchObject({ firstHalfValue: 120, secondHalfValue: 150 });
  });

  it("uses the average (not sum) for flow metrics and flags a decline", () => {
    const points = [
      { date: "2026-07-01", metrics: { reach: 100 } },
      { date: "2026-07-02", metrics: { reach: 100 } },
      { date: "2026-07-03", metrics: { reach: 100 } },
      { date: "2026-07-04", metrics: { reach: 50 } },
      { date: "2026-07-05", metrics: { reach: 50 } },
      { date: "2026-07-06", metrics: { reach: 50 } },
    ];

    const result = buildMetricTrends(points);
    const reach = result.metrics.find((m) => m.key === "reach");

    expect(result.sufficientData).toBe(true);
    expect(reach).toMatchObject({ firstHalfValue: 100, secondHalfValue: 50, changePercent: -50, isDeclining: true });
  });
});

describe("buildDemandSignal", () => {
  it("marks demand signal unavailable when there are no leads", () => {
    expect(buildDemandSignal([])).toEqual({ available: false, destinationCounts: [] });
  });

  it("groups and ranks leads by destination, ignoring blank destinations", () => {
    const leads = [{ destination: "Дубай" }, { destination: "Дубай" }, { destination: "Бали" }, { destination: null }];

    expect(buildDemandSignal(leads)).toEqual({
      available: true,
      destinationCounts: [
        { destination: "Дубай", count: 2 },
        { destination: "Бали", count: 1 },
      ],
    });
  });
});

function buildInputs(overrides: Partial<InsightsInputs> = {}): InsightsInputs {
  return {
    range: { from: "2026-04-16", to: "2026-07-14" },
    metricTrends: { sufficientData: false, metrics: [] },
    topMedia: [],
    bottomMedia: [],
    weekdayPattern: [],
    timeOfDayPattern: [],
    anomalies: [],
    formatBreakdown: [],
    demandSignal: { available: false, destinationCounts: [] },
    ...overrides,
  };
}

describe("buildInsightsPrompt", () => {
  it("embeds the period range and serialized inputs as JSON", () => {
    const prompt = buildInsightsPrompt(buildInputs());

    expect(prompt).toContain("2026-04-16 — 2026-07-14");
    expect(prompt).toContain('"sufficientData": false');
  });

  it("tells the model demand data is unavailable in plain language, without the field name", () => {
    const prompt = buildInsightsPrompt(buildInputs({ demandSignal: { available: false, destinationCounts: [] } }));

    expect(prompt).toContain("Данных о заявках пока нет");
    expect(prompt).not.toContain("demandSignal.available");
  });
});

describe("parseInsightsContent", () => {
  it("accepts a well-formed structured response", () => {
    const raw = {
      summary: "Аккаунт молодой, данных пока мало.",
      observations: ["Подписчики выросли с 0 до 217."],
      gaps: ["Нет данных по вовлечённости в разрезе форматов."],
      direction: "Сфокусироваться на сборе базовой аналитики.",
      recommendations: ["Публиковать регулярно, чтобы накопить данные."],
    };

    expect(parseInsightsContent(raw)).toEqual(raw);
  });

  it("rejects a response missing required fields or with wrong types", () => {
    expect(parseInsightsContent({ summary: "..." })).toBeNull();
    expect(
      parseInsightsContent({
        summary: "...",
        observations: [1],
        gaps: [],
        direction: "...",
        recommendations: [],
      }),
    ).toBeNull();
    expect(parseInsightsContent(null)).toBeNull();
    expect(parseInsightsContent("not an object")).toBeNull();
  });
});

describe("shouldSkipManualInsights", () => {
  it("skips when the last manual report is under 5 minutes old", () => {
    const now = new Date("2026-07-14T12:05:00Z");
    expect(shouldSkipManualInsights({ createdAt: new Date("2026-07-14T12:02:00Z") }, now)).toBe(true);
  });

  it("allows a new analysis once 5 minutes have passed", () => {
    const now = new Date("2026-07-14T12:10:00Z");
    expect(shouldSkipManualInsights({ createdAt: new Date("2026-07-14T12:02:00Z") }, now)).toBe(false);
  });

  it("allows analysis when there is no prior report", () => {
    expect(shouldSkipManualInsights(null, new Date())).toBe(false);
  });
});

describe("isInsightsDigestDue", () => {
  it("is not due before 7 days have passed", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    expect(isInsightsDigestDue({ createdAt: new Date("2026-07-10T00:00:00Z") }, now)).toBe(false);
  });

  it("is due once 7 days have passed", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    expect(isInsightsDigestDue({ createdAt: new Date("2026-07-07T00:00:00Z") }, now)).toBe(true);
  });

  it("is due when there is no prior digest report", () => {
    expect(isInsightsDigestDue(null, new Date())).toBe(true);
  });
});
