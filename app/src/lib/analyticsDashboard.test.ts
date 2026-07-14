import { describe, expect, it } from "vitest";
import {
  buildMetricSeries,
  buildAccountMetricCharts,
  hasEnoughDataForChart,
  buildMediaTableRows,
  parseAgeGenderBreakdown,
  parseGeographyBreakdown,
} from "./analyticsDashboard";

describe("buildMetricSeries", () => {
  it("extracts one metric into a {date, value} series", () => {
    const dailyPoints = [
      { date: "2026-07-10", metrics: { reach: 120, followerCount: 200 } },
      { date: "2026-07-11", metrics: { reach: 150, followerCount: 205 } },
    ];

    expect(buildMetricSeries(dailyPoints, "reach")).toEqual([
      { date: "2026-07-10", value: 120 },
      { date: "2026-07-11", value: 150 },
    ]);
  });

  it("defaults to 0 when the metric is missing or not a number", () => {
    const dailyPoints = [{ date: "2026-07-10", metrics: { reach: "n/a" } }];

    expect(buildMetricSeries(dailyPoints, "reach")).toEqual([{ date: "2026-07-10", value: 0 }]);
    expect(buildMetricSeries(dailyPoints, "website_clicks")).toEqual([{ date: "2026-07-10", value: 0 }]);
  });
});

describe("buildAccountMetricCharts", () => {
  it("builds one chart per known account metric, in a fixed order", () => {
    const dailyPoints = [{ date: "2026-07-10", metrics: { reach: 120, followerCount: 200 } }];

    const charts = buildAccountMetricCharts(dailyPoints);

    expect(charts.map((c) => c.key)).toEqual([
      "followerCount",
      "reach",
      "profile_views",
      "accounts_engaged",
      "total_interactions",
      "website_clicks",
    ]);
    expect(charts[0].label).toBe("Подписчики");
    expect(charts[0].series).toEqual([{ date: "2026-07-10", value: 200 }]);
  });
});

describe("hasEnoughDataForChart", () => {
  it("requires at least 2 points", () => {
    expect(hasEnoughDataForChart([])).toBe(false);
    expect(hasEnoughDataForChart([{ date: "2026-07-10", value: 1 }])).toBe(false);
    expect(
      hasEnoughDataForChart([
        { date: "2026-07-10", value: 1 },
        { date: "2026-07-11", value: 2 },
      ]),
    ).toBe(true);
  });
});

describe("buildMediaTableRows", () => {
  it("attaches the latest reach snapshot to each media row", () => {
    const media = [
      {
        id: "media-1",
        mediaType: "IMAGE",
        mediaProductType: "FEED",
        caption: "Тур в Бухару",
        permalink: "https://instagram.com/p/abc",
        postedAt: new Date("2026-07-10T12:00:00Z"),
        likeCount: 42,
        commentsCount: 5,
      },
      {
        id: "media-2",
        mediaType: "VIDEO",
        mediaProductType: "REELS",
        caption: null,
        permalink: null,
        postedAt: new Date("2026-07-11T12:00:00Z"),
        likeCount: 10,
        commentsCount: 1,
      },
    ];
    const latestMetricsByMediaId = new Map([["media-1", { reach: 300, likes: 42 }]]);

    const rows = buildMediaTableRows(media, latestMetricsByMediaId);

    expect(rows[0].reach).toBe(300);
    expect(rows[1].reach).toBeNull();
  });
});

describe("parseAgeGenderBreakdown", () => {
  it("pivots dimension_values [age, gender] into one bar per age group", () => {
    const data = [
      {
        total_value: {
          breakdowns: [
            {
              dimension_keys: ["age", "gender"],
              results: [
                { dimension_values: ["25-34", "F"], value: 12 },
                { dimension_values: ["25-34", "M"], value: 8 },
                { dimension_values: ["18-24", "F"], value: 5 },
              ],
            },
          ],
        },
      },
    ];

    expect(parseAgeGenderBreakdown(data)).toEqual([
      { ageGroup: "18-24", F: 5 },
      { ageGroup: "25-34", F: 12, M: 8 },
    ]);
  });

  it("returns an empty array for empty/missing breakdown data", () => {
    expect(parseAgeGenderBreakdown([])).toEqual([]);
    expect(parseAgeGenderBreakdown([{}])).toEqual([]);
  });
});

describe("parseGeographyBreakdown", () => {
  it("sorts countries by follower count descending", () => {
    const data = [
      {
        total_value: {
          breakdowns: [
            {
              dimension_keys: ["country"],
              results: [
                { dimension_values: ["UZ"], value: 150 },
                { dimension_values: ["RU"], value: 40 },
                { dimension_values: ["US"], value: 200 },
              ],
            },
          ],
        },
      },
    ];

    expect(parseGeographyBreakdown(data)).toEqual([
      { country: "US", value: 200 },
      { country: "UZ", value: 150 },
      { country: "RU", value: 40 },
    ]);
  });
});
