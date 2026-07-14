import { ACCOUNT_METRIC_LABELS } from "./analyticsDashboard";
import {
  FLOW_METRIC_KEYS,
  STOCK_METRIC_KEYS,
  type MediaEngagement,
  type TimePatternBucket,
  type Anomaly,
} from "./analyticsSummary";

export type MediaFormat = "reels" | "carousel" | "photo" | "video";

const FORMAT_ORDER: MediaFormat[] = ["reels", "carousel", "photo", "video"];
const FORMAT_LABELS: Record<MediaFormat, string> = {
  reels: "Reels",
  carousel: "Карусель",
  photo: "Фото",
  video: "Видео",
};

function classifyFormat(mediaType: string, mediaProductType: string | null): MediaFormat {
  if (mediaProductType === "REELS") return "reels";
  if (mediaType === "CAROUSEL_ALBUM") return "carousel";
  if (mediaType === "VIDEO") return "video";
  return "photo";
}

export interface MediaFormatEngagement {
  id: string;
  format: MediaFormat;
  totalInteractions: number;
  postedAt: Date;
}

export function buildMediaFormatEngagements(
  media: Array<{ id: string; mediaType: string; mediaProductType: string | null; postedAt: Date }>,
  latestMetricsByMediaId: Map<string, Record<string, unknown>>,
): MediaFormatEngagement[] {
  return media.map((item) => {
    const metrics = latestMetricsByMediaId.get(item.id);
    const totalInteractions =
      metrics && typeof metrics.total_interactions === "number" ? metrics.total_interactions : 0;
    return {
      id: item.id,
      format: classifyFormat(item.mediaType, item.mediaProductType),
      totalInteractions,
      postedAt: item.postedAt,
    };
  });
}

const MIN_FORMAT_SAMPLES = 3;

export interface FormatBucket {
  format: MediaFormat;
  label: string;
  averageInteractions: number;
  sampleSize: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function numericMetric(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function buildFormatBreakdown(engagements: MediaFormatEngagement[]): FormatBucket[] {
  const buckets = new Map<MediaFormat, number[]>();
  for (const engagement of engagements) {
    const values = buckets.get(engagement.format) ?? [];
    values.push(engagement.totalInteractions);
    buckets.set(engagement.format, values);
  }
  return FORMAT_ORDER.map((format) => {
    const values = buckets.get(format) ?? [];
    return { format, label: FORMAT_LABELS[format], averageInteractions: average(values), sampleSize: values.length };
  }).filter((bucket) => bucket.sampleSize >= MIN_FORMAT_SAMPLES);
}

const MIN_TREND_POINTS = 6;
const TREND_DECLINE_THRESHOLD_PERCENT = -20;
const ALL_METRIC_KEYS = [...STOCK_METRIC_KEYS, ...FLOW_METRIC_KEYS];
const STOCK_METRIC_KEY_SET: readonly string[] = STOCK_METRIC_KEYS;

export interface MetricTrend {
  key: string;
  label: string;
  firstHalfValue: number;
  secondHalfValue: number;
  changePercent: number | null;
  isDeclining: boolean;
}

export interface MetricTrends {
  sufficientData: boolean;
  metrics: MetricTrend[];
}

function lastValue(points: Array<{ metrics: Record<string, unknown> }>, key: string): number {
  return points.length > 0 ? numericMetric(points[points.length - 1].metrics[key]) : 0;
}

export function buildMetricTrends(dailyPoints: Array<{ date: string; metrics: Record<string, unknown> }>): MetricTrends {
  const sorted = [...dailyPoints].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < MIN_TREND_POINTS) {
    return { sufficientData: false, metrics: [] };
  }

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const metrics = ALL_METRIC_KEYS.map((key) => {
    const isStock = STOCK_METRIC_KEY_SET.includes(key);
    const firstHalfValue = isStock
      ? lastValue(firstHalf, key)
      : average(firstHalf.map((p) => numericMetric(p.metrics[key])));
    const secondHalfValue = isStock
      ? lastValue(secondHalf, key)
      : average(secondHalf.map((p) => numericMetric(p.metrics[key])));
    const changePercent = firstHalfValue === 0 ? null : ((secondHalfValue - firstHalfValue) / firstHalfValue) * 100;

    return {
      key,
      label: ACCOUNT_METRIC_LABELS[key],
      firstHalfValue,
      secondHalfValue,
      changePercent,
      isDeclining: changePercent !== null && changePercent < TREND_DECLINE_THRESHOLD_PERCENT,
    };
  });

  return { sufficientData: true, metrics };
}

export interface DemandSignal {
  available: boolean;
  destinationCounts: Array<{ destination: string; count: number }>;
}

export function buildDemandSignal(leads: Array<{ destination: string | null }>): DemandSignal {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.destination?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const destinationCounts = [...counts.entries()]
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count);
  return { available: destinationCounts.length > 0, destinationCounts };
}

export interface InsightsInputs {
  range: { from: string; to: string };
  metricTrends: MetricTrends;
  topMedia: MediaEngagement[];
  bottomMedia: MediaEngagement[];
  weekdayPattern: TimePatternBucket[];
  timeOfDayPattern: TimePatternBucket[];
  anomalies: Anomaly[];
  formatBreakdown: FormatBucket[];
  demandSignal: DemandSignal;
}

export function buildInsightsPrompt(inputs: InsightsInputs): string {
  const demandNote = inputs.demandSignal.available
    ? "Данные о заявках есть — свяжи их с контентом, укажи разрывы между спросом и тем, что публикуется."
    : "Данных о заявках пока нет — прямо скажи, что связать спрос с контентом сейчас нельзя, не выдумывай его.";
  const trendNote = inputs.metricTrends.sufficientData
    ? ""
    : "Данных пока недостаточно, чтобы оценить тренд по метрикам за два сопоставимых периода внутри окна — скажи об этом прямо, не додумывай направление.";

  return [
    `Полный разбор Instagram-аккаунта турагентства за 90-дневное окно ${inputs.range.from} — ${inputs.range.to}:`,
    "",
    JSON.stringify(inputs, null, 2),
    "",
    demandNote,
    trendNote,
    "Дай общую картину, наблюдения по цифрам, пробелы (в данных или в самом аккаунте), направление развития и приоритизированные рекомендации.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export interface InsightsContent {
  summary: string;
  observations: string[];
  gaps: string[];
  direction: string;
  recommendations: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseInsightsContent(raw: unknown): InsightsContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.summary !== "string") return null;
  if (!isStringArray(obj.observations)) return null;
  if (!isStringArray(obj.gaps)) return null;
  if (typeof obj.direction !== "string") return null;
  if (!isStringArray(obj.recommendations)) return null;

  return {
    summary: obj.summary,
    observations: obj.observations,
    gaps: obj.gaps,
    direction: obj.direction,
    recommendations: obj.recommendations,
  };
}

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldSkipManualInsights(lastManualReport: { createdAt: Date } | null, now: Date): boolean {
  if (!lastManualReport) return false;
  return now.getTime() - lastManualReport.createdAt.getTime() < MANUAL_COOLDOWN_MS;
}

export function isInsightsDigestDue(lastDigestReport: { createdAt: Date } | null, now: Date): boolean {
  if (!lastDigestReport) return true;
  return now.getTime() - lastDigestReport.createdAt.getTime() >= DIGEST_INTERVAL_MS;
}
