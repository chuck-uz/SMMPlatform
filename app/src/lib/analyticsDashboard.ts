export const ACCOUNT_METRIC_KEYS = [
  "followerCount",
  "reach",
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "website_clicks",
] as const;

export const ACCOUNT_METRIC_LABELS: Record<string, string> = {
  followerCount: "Подписчики",
  reach: "Охват",
  profile_views: "Просмотры профиля",
  accounts_engaged: "Вовлечённые аккаунты",
  total_interactions: "Всего взаимодействий",
  website_clicks: "Переходы на сайт",
};

export interface MetricPoint {
  date: string;
  value: number;
}

export function buildMetricSeries(
  dailyPoints: Array<{ date: string; metrics: Record<string, unknown> }>,
  metricKey: string,
): MetricPoint[] {
  return dailyPoints.map((point) => {
    const raw = point.metrics[metricKey];
    return { date: point.date, value: typeof raw === "number" ? raw : 0 };
  });
}

export interface AccountMetricChart {
  key: string;
  label: string;
  series: MetricPoint[];
}

export function buildAccountMetricCharts(
  dailyPoints: Array<{ date: string; metrics: Record<string, unknown> }>,
): AccountMetricChart[] {
  return ACCOUNT_METRIC_KEYS.map((key) => ({
    key,
    label: ACCOUNT_METRIC_LABELS[key],
    series: buildMetricSeries(dailyPoints, key),
  }));
}

export function hasEnoughDataForChart(series: MetricPoint[]): boolean {
  return series.length >= 2;
}

export interface MediaTableRow {
  id: string;
  mediaType: string;
  mediaProductType: string | null;
  caption: string | null;
  permalink: string | null;
  postedAt: Date;
  likeCount: number;
  commentsCount: number;
  reach: number | null;
}

export function buildMediaTableRows(
  media: Array<{
    id: string;
    mediaType: string;
    mediaProductType: string | null;
    caption: string | null;
    permalink: string | null;
    postedAt: Date;
    likeCount: number;
    commentsCount: number;
  }>,
  latestMetricsByMediaId: Map<string, Record<string, unknown>>,
): MediaTableRow[] {
  return media.map((item) => {
    const metrics = latestMetricsByMediaId.get(item.id);
    const reach = metrics && typeof metrics.reach === "number" ? metrics.reach : null;
    return { ...item, reach };
  });
}

interface BreakdownResult {
  dimension_values: string[];
  value: number;
}

function extractBreakdownResults(data: unknown[]): BreakdownResult[] {
  const results: BreakdownResult[] = [];
  for (const entry of data) {
    const breakdowns =
      (entry as { total_value?: { breakdowns?: Array<{ results?: Array<{ dimension_values?: string[]; value?: number }> }> } })
        ?.total_value?.breakdowns ?? [];
    for (const breakdown of breakdowns) {
      for (const result of breakdown.results ?? []) {
        if (result.dimension_values && typeof result.value === "number") {
          results.push({ dimension_values: result.dimension_values, value: result.value });
        }
      }
    }
  }
  return results;
}

export interface AgeGenderBar {
  ageGroup: string;
  [gender: string]: string | number;
}

export function parseAgeGenderBreakdown(data: unknown[]): AgeGenderBar[] {
  const byAgeGroup = new Map<string, AgeGenderBar>();

  for (const result of extractBreakdownResults(data)) {
    const [ageGroup, gender] = result.dimension_values;
    if (!ageGroup || !gender) continue;
    const bar = byAgeGroup.get(ageGroup) ?? { ageGroup };
    const existing = typeof bar[gender] === "number" ? (bar[gender] as number) : 0;
    bar[gender] = existing + result.value;
    byAgeGroup.set(ageGroup, bar);
  }

  return [...byAgeGroup.values()].sort((a, b) => a.ageGroup.localeCompare(b.ageGroup));
}

export interface CountryBar {
  country: string;
  value: number;
}

export function parseGeographyBreakdown(data: unknown[]): CountryBar[] {
  return extractBreakdownResults(data)
    .map((result) => ({ country: result.dimension_values[0] ?? "—", value: result.value }))
    .sort((a, b) => b.value - a.value);
}
