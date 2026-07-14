import { describe, expect, it } from "vitest";
import {
  serializeSummaryForPrompt,
  buildAnalysisPrompt,
  shouldSkipManualAnalysis,
  isDigestDue,
  parseAnalysisContent,
} from "./analysisReport";
import type { PeriodSummary } from "./analyticsSummary";

function buildSummary(overrides: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    range: {
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-07-08T00:00:00Z"),
      previousFrom: new Date("2026-06-24T00:00:00Z"),
      previousTo: new Date("2026-07-01T00:00:00Z"),
    },
    metricDeltas: [{ key: "reach", label: "Охват", current: 100, previous: 80, changePercent: 25 }],
    topMedia: [
      {
        id: "1",
        caption: "Post",
        mediaProductType: "FEED",
        postedAt: new Date("2026-07-05T10:00:00Z"),
        totalInteractions: 50,
      },
    ],
    bottomMedia: [],
    weekdayPattern: [],
    timeOfDayPattern: [],
    anomalies: [],
    ...overrides,
  };
}

describe("serializeSummaryForPrompt", () => {
  it("converts all Date fields to plain date strings", () => {
    const serialized = serializeSummaryForPrompt(buildSummary());

    expect(serialized.range).toEqual({
      from: "2026-07-01",
      to: "2026-07-08",
      previousFrom: "2026-06-24",
      previousTo: "2026-07-01",
    });
    expect(serialized.topMedia[0].postedAt).toBe("2026-07-05");
  });
});

describe("buildAnalysisPrompt", () => {
  it("embeds the serialized summary as JSON with the period range in the header", () => {
    const prompt = buildAnalysisPrompt(buildSummary());

    expect(prompt).toContain("2026-07-01 — 2026-07-08");
    expect(prompt).toContain('"totalInteractions": 50');
  });
});

describe("shouldSkipManualAnalysis", () => {
  it("skips when the last manual report is under 5 minutes old", () => {
    const now = new Date("2026-07-14T12:05:00Z");
    const lastReport = { createdAt: new Date("2026-07-14T12:02:00Z") };

    expect(shouldSkipManualAnalysis(lastReport, now)).toBe(true);
  });

  it("allows a new analysis once 5 minutes have passed", () => {
    const now = new Date("2026-07-14T12:10:00Z");
    const lastReport = { createdAt: new Date("2026-07-14T12:02:00Z") };

    expect(shouldSkipManualAnalysis(lastReport, now)).toBe(false);
  });

  it("allows analysis when there is no prior report", () => {
    expect(shouldSkipManualAnalysis(null, new Date())).toBe(false);
  });
});

describe("isDigestDue", () => {
  it("is not due before 7 days have passed", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const lastReport = { createdAt: new Date("2026-07-10T00:00:00Z") };

    expect(isDigestDue(lastReport, now)).toBe(false);
  });

  it("is due once 7 days have passed", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const lastReport = { createdAt: new Date("2026-07-07T00:00:00Z") };

    expect(isDigestDue(lastReport, now)).toBe(true);
  });

  it("is due when there is no prior weekly report", () => {
    expect(isDigestDue(null, new Date())).toBe(true);
  });
});

describe("parseAnalysisContent", () => {
  it("accepts a well-formed structured response", () => {
    const raw = {
      summary: "Охват вырос на 25%.",
      observations: ["Охват: 100 против 80 в прошлом периоде (+25%)."],
      recommendations: ["Опубликовать ещё один Reels в это же время."],
    };

    expect(parseAnalysisContent(raw)).toEqual(raw);
  });

  it("rejects a response missing required fields", () => {
    expect(parseAnalysisContent({ summary: "..." })).toBeNull();
    expect(parseAnalysisContent({ summary: "...", observations: [1, 2], recommendations: [] })).toBeNull();
    expect(parseAnalysisContent(null)).toBeNull();
    expect(parseAnalysisContent("not an object")).toBeNull();
  });
});
