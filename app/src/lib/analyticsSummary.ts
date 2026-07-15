import { ACCOUNT_METRIC_LABELS } from "./analyticsDashboard";

export const FLOW_METRIC_KEYS = ["reach", "profile_views", "accounts_engaged", "total_interactions", "website_clicks"] as const;
export const STOCK_METRIC_KEYS = ["followerCount"] as const;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface MediaEngagement {
  id: string;
  caption: string | null;
  mediaProductType: string | null;
  postedAt: Date;
  totalInteractions: number;
}

export function buildMediaEngagements(
  media: Array<{ id: string; caption: string | null; mediaProductType: string | null; postedAt: Date }>,
  latestMetricsByMediaId: Map<string, Record<string, unknown>>,
): MediaEngagement[] {
  return media
    .filter((item) => item.mediaProductType === "FEED" || item.mediaProductType === "REELS")
    .map((item) => {
      const metrics = latestMetricsByMediaId.get(item.id);
      const totalInteractions =
        metrics && typeof metrics.total_interactions === "number" ? metrics.total_interactions : 0;
      return {
        id: item.id,
        caption: item.caption,
        mediaProductType: item.mediaProductType,
        postedAt: item.postedAt,
        totalInteractions,
      };
    });
}

export function rankMedia(engagements: MediaEngagement[]): { top: MediaEngagement[]; bottom: MediaEngagement[] } {
  const sorted = [...engagements].sort((a, b) => b.totalInteractions - a.totalInteractions);
  const top = sorted.slice(0, 3);
  const remaining = sorted.slice(3);
  const bottom = remaining.length > 0 ? remaining.slice(-3).reverse() : [];
  return { top, bottom };
}

const MIN_BUCKET_SAMPLES = 3;

// The agency operates in Tashkent (UTC+5, no DST). Posting-time patterns must be
// bucketed by local time, not UTC — otherwise the day-of-week / time-of-day
// labels (e.g. "Вечер (18–24)") are shifted 5 hours off what the manager sees.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
function toTashkent(date: Date): Date {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS);
}

export interface TimePatternBucket {
  key: string;
  label: string;
  averageInteractions: number;
  sampleSize: number;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS: Record<number, string> = { 0: "Вс", 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб" };

export function buildWeekdayPattern(engagements: MediaEngagement[]): TimePatternBucket[] {
  const buckets = new Map<number, number[]>();
  for (const engagement of engagements) {
    const day = toTashkent(engagement.postedAt).getUTCDay();
    const values = buckets.get(day) ?? [];
    values.push(engagement.totalInteractions);
    buckets.set(day, values);
  }
  return WEEKDAY_ORDER.map((day) => {
    const values = buckets.get(day) ?? [];
    return { key: String(day), label: WEEKDAY_LABELS[day], averageInteractions: average(values), sampleSize: values.length };
  }).filter((bucket) => bucket.sampleSize >= MIN_BUCKET_SAMPLES);
}

const TIME_OF_DAY_BUCKETS: Array<{ key: string; label: string; matches: (hour: number) => boolean }> = [
  { key: "morning", label: "Утро (6–12)", matches: (h) => h >= 6 && h < 12 },
  { key: "afternoon", label: "День (12–18)", matches: (h) => h >= 12 && h < 18 },
  { key: "evening", label: "Вечер (18–24)", matches: (h) => h >= 18 && h < 24 },
  { key: "night", label: "Ночь (0–6)", matches: (h) => h >= 0 && h < 6 },
];

export function buildTimeOfDayPattern(engagements: MediaEngagement[]): TimePatternBucket[] {
  return TIME_OF_DAY_BUCKETS.map((bucket) => {
    const values = engagements
      .filter((engagement) => bucket.matches(toTashkent(engagement.postedAt).getUTCHours()))
      .map((engagement) => engagement.totalInteractions);
    return { key: bucket.key, label: bucket.label, averageInteractions: average(values), sampleSize: values.length };
  }).filter((bucket) => bucket.sampleSize >= MIN_BUCKET_SAMPLES);
}

const ANOMALY_THRESHOLD_PERCENT = 50;
const MIN_ANOMALY_POINTS = 4;

export interface Anomaly {
  metricKey: string;
  metricLabel: string;
  date: string;
  value: number;
  average: number;
  changePercent: number;
}

export function detectAnomalies(
  dailyPoints: Array<{ date: string; metrics: Record<string, unknown> }>,
  metricKeys: readonly string[] = [...STOCK_METRIC_KEYS, ...FLOW_METRIC_KEYS],
): Anomaly[] {
  if (dailyPoints.length < MIN_ANOMALY_POINTS) return [];

  const anomalies: Anomaly[] = [];
  for (const key of metricKeys) {
    for (let i = 0; i < dailyPoints.length; i++) {
      const others = dailyPoints.filter((_, idx) => idx !== i);
      const avg = average(
        others.map((p) => (typeof p.metrics[key] === "number" ? (p.metrics[key] as number) : 0)),
      );
      if (avg === 0) continue;
      const value = typeof dailyPoints[i].metrics[key] === "number" ? (dailyPoints[i].metrics[key] as number) : 0;
      const change = ((value - avg) / avg) * 100;
      if (Math.abs(change) > ANOMALY_THRESHOLD_PERCENT) {
        anomalies.push({
          metricKey: key,
          metricLabel: ACCOUNT_METRIC_LABELS[key],
          date: dailyPoints[i].date,
          value,
          average: avg,
          changePercent: change,
        });
      }
    }
  }
  return anomalies;
}
