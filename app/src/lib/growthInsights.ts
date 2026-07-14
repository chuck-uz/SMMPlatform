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

export interface ReachTrend {
  firstHalfAverage: number;
  secondHalfAverage: number;
  changePercent: number | null;
  isDeclining: boolean;
  sufficientData: boolean;
}

function numericMetric(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function buildReachTrend(dailyPoints: Array<{ date: string; metrics: Record<string, unknown> }>): ReachTrend {
  const sorted = [...dailyPoints].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < MIN_TREND_POINTS) {
    return { firstHalfAverage: 0, secondHalfAverage: 0, changePercent: null, isDeclining: false, sufficientData: false };
  }

  const mid = Math.floor(sorted.length / 2);
  const firstHalfAverage = average(sorted.slice(0, mid).map((p) => numericMetric(p.metrics.reach)));
  const secondHalfAverage = average(sorted.slice(mid).map((p) => numericMetric(p.metrics.reach)));
  const changePercent = firstHalfAverage === 0 ? null : ((secondHalfAverage - firstHalfAverage) / firstHalfAverage) * 100;

  return {
    firstHalfAverage,
    secondHalfAverage,
    changePercent,
    isDeclining: changePercent !== null && changePercent < TREND_DECLINE_THRESHOLD_PERCENT,
    sufficientData: true,
  };
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

export interface GrowthInputs {
  range: { from: string; to: string };
  formatBreakdown: FormatBucket[];
  reachTrend: ReachTrend;
  demandSignal: DemandSignal;
}

export function buildGrowthPrompt(inputs: GrowthInputs): string {
  const demandNote = inputs.demandSignal.available
    ? "Данные о заявках есть — используй их для раздела о разрыве между спросом и контентом."
    : "Важно: данных о заявках пока нет (раздел demandSignal.available = false). Явно скажи, что связку с заявками пока показать нельзя — не выдумывай спрос.";

  return [
    `Анализ узких мест и направления роста Instagram-аккаунта турагентства за 90-дневное окно ${inputs.range.from} — ${inputs.range.to}:`,
    "",
    JSON.stringify(inputs, null, 2),
    "",
    demandNote,
    "Сделай разбор узких мест, предложи направление развития аккаунта и приоритеты роста.",
  ].join("\n");
}

export interface GrowthInsightContent {
  bottlenecks: string[];
  direction: string;
  growthPriorities: string[];
}

export function parseGrowthContent(raw: unknown): GrowthInsightContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.bottlenecks) || !obj.bottlenecks.every((b) => typeof b === "string")) return null;
  if (typeof obj.direction !== "string") return null;
  if (!Array.isArray(obj.growthPriorities) || !obj.growthPriorities.every((p) => typeof p === "string")) return null;

  return {
    bottlenecks: obj.bottlenecks as string[],
    direction: obj.direction,
    growthPriorities: obj.growthPriorities as string[],
  };
}

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
const DIGEST_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldSkipManualGrowthAnalysis(lastManualReport: { createdAt: Date } | null, now: Date): boolean {
  if (!lastManualReport) return false;
  return now.getTime() - lastManualReport.createdAt.getTime() < MANUAL_COOLDOWN_MS;
}

export function isGrowthDigestDue(lastDigestReport: { createdAt: Date } | null, now: Date): boolean {
  if (!lastDigestReport) return true;
  return now.getTime() - lastDigestReport.createdAt.getTime() >= DIGEST_INTERVAL_MS;
}
