import type { PeriodSummary, MediaEngagement } from "./analyticsSummary";

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type SerializedMediaEngagement = Omit<MediaEngagement, "postedAt"> & { postedAt: string };

export interface SerializedSummary {
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  metricDeltas: PeriodSummary["metricDeltas"];
  topMedia: SerializedMediaEngagement[];
  bottomMedia: SerializedMediaEngagement[];
  weekdayPattern: PeriodSummary["weekdayPattern"];
  timeOfDayPattern: PeriodSummary["timeOfDayPattern"];
  anomalies: PeriodSummary["anomalies"];
}

export function serializeSummaryForPrompt(summary: PeriodSummary): SerializedSummary {
  return {
    range: {
      from: formatDateOnly(summary.range.from),
      to: formatDateOnly(summary.range.to),
      previousFrom: formatDateOnly(summary.range.previousFrom),
      previousTo: formatDateOnly(summary.range.previousTo),
    },
    metricDeltas: summary.metricDeltas,
    topMedia: summary.topMedia.map((m) => ({ ...m, postedAt: formatDateOnly(m.postedAt) })),
    bottomMedia: summary.bottomMedia.map((m) => ({ ...m, postedAt: formatDateOnly(m.postedAt) })),
    weekdayPattern: summary.weekdayPattern,
    timeOfDayPattern: summary.timeOfDayPattern,
    anomalies: summary.anomalies,
  };
}

export function buildAnalysisPrompt(summary: PeriodSummary): string {
  const serialized = serializeSummaryForPrompt(summary);
  return [
    `Сводка метрик Instagram-аккаунта за период ${serialized.range.from} — ${serialized.range.to} ` +
      `(сравнение с периодом ${serialized.range.previousFrom} — ${serialized.range.previousTo}):`,
    "",
    JSON.stringify(serialized, null, 2),
    "",
    "Сделай разбор по этой сводке.",
  ].join("\n");
}

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldSkipManualAnalysis(
  lastManualReport: { createdAt: Date } | null,
  now: Date,
): boolean {
  if (!lastManualReport) return false;
  return now.getTime() - lastManualReport.createdAt.getTime() < MANUAL_COOLDOWN_MS;
}

export function isDigestDue(lastWeeklyReport: { createdAt: Date } | null, now: Date): boolean {
  if (!lastWeeklyReport) return true;
  return now.getTime() - lastWeeklyReport.createdAt.getTime() >= DIGEST_INTERVAL_MS;
}

export interface AnalysisContent {
  summary: string;
  observations: string[];
  recommendations: string[];
}

export function parseAnalysisContent(raw: unknown): AnalysisContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.summary !== "string") return null;
  if (!Array.isArray(obj.observations) || !obj.observations.every((o) => typeof o === "string")) {
    return null;
  }
  if (!Array.isArray(obj.recommendations) || !obj.recommendations.every((r) => typeof r === "string")) {
    return null;
  }

  return {
    summary: obj.summary,
    observations: obj.observations as string[],
    recommendations: obj.recommendations as string[],
  };
}
