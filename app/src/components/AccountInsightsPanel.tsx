import type { MediaEngagement, TimePatternBucket, Anomaly } from "@/lib/analyticsSummary";
import type { MetricTrends, FormatBucket, DemandSignal } from "@/lib/accountInsights";

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function ChangeBadge({ changePercent }: { changePercent: number | null }) {
  if (changePercent === null) {
    return <span className="text-[12.5px] text-subtle">—</span>;
  }
  const positive = changePercent >= 0;
  return (
    <span className={`text-[12.5px] font-medium ${positive ? "text-accent" : "text-destructive"}`}>
      {positive ? "+" : ""}
      {changePercent.toFixed(0)}%
    </span>
  );
}

function MediaList({ title, items, emptyText }: { title: string; items: MediaEngagement[]; emptyText: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-subtle">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-foreground">{item.caption || "Без подписи"}</span>
              <span className="shrink-0 text-subtle">
                {formatDate(item.postedAt)} · {item.totalInteractions}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PatternList({ title, buckets }: { title: string; buckets: TimePatternBucket[] }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
      {buckets.length === 0 ? (
        <p className="mt-2 text-[13px] text-subtle">Пока недостаточно публикаций (нужно 3+ на корзину), чтобы выявить паттерн.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {buckets.map((bucket) => (
            <li key={bucket.key} className="flex items-center justify-between text-[13px]">
              <span className="text-foreground">{bucket.label}</span>
              <span className="text-subtle">{bucket.averageInteractions.toFixed(0)} в среднем</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountInsightsPanel({
  metricTrends,
  topMedia,
  bottomMedia,
  weekdayPattern,
  timeOfDayPattern,
  anomalies,
  formatBreakdown,
  demandSignal,
}: {
  metricTrends: MetricTrends;
  topMedia: MediaEngagement[];
  bottomMedia: MediaEngagement[];
  weekdayPattern: TimePatternBucket[];
  timeOfDayPattern: TimePatternBucket[];
  anomalies: Anomaly[];
  formatBreakdown: FormatBucket[];
  demandSignal: DemandSignal;
}) {
  return (
    <div className="space-y-4">
      {!metricTrends.sufficientData ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card p-5 text-[13px] text-subtle">
          Пока недостаточно дней истории (нужно 6+), чтобы сравнить первую и вторую половину 90-дневного окна.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metricTrends.metrics.map((metric) => (
            <div key={metric.key} className="rounded-[14px] border border-border bg-card p-4 shadow-card">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">{metric.label}</div>
              <div className="mt-1 text-[20px] font-bold text-foreground">{metric.secondHalfValue.toFixed(0)}</div>
              <div className="mt-0.5">
                <ChangeBadge changePercent={metric.changePercent} />
                <span className="ml-1 text-[12px] text-subtle">к первой половине окна</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MediaList title="Лучшие публикации" items={topMedia} emptyText="Нет постов/Reels за окно." />
        <MediaList title="Худшие публикации" items={bottomMedia} emptyText="Недостаточно публикаций для сравнения." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PatternList title="Паттерн по дню недели" buckets={weekdayPattern} />
        <PatternList title="Паттерн по времени суток" buckets={timeOfDayPattern} />
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h4 className="text-[13px] font-semibold text-foreground">Вовлечённость по форматам</h4>
        {formatBreakdown.length === 0 ? (
          <p className="mt-2 text-[13px] text-subtle">
            Пока недостаточно публикаций одного формата (нужно 3+), чтобы сравнить форматы между собой.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {formatBreakdown.map((bucket) => (
              <li key={bucket.format} className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">{bucket.label}</span>
                <span className="text-subtle">{bucket.averageInteractions.toFixed(0)} в среднем · {bucket.sampleSize} публикаций</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h4 className="text-[13px] font-semibold text-foreground">Спрос по направлениям (из заявок)</h4>
        {!demandSignal.available ? (
          <p className="mt-2 text-[13px] text-subtle">Заявок пока нет — здесь появится спрос по направлениям, когда заработает живой канал.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {demandSignal.destinationCounts.map((item) => (
              <li key={item.destination} className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">{item.destination}</span>
                <span className="text-subtle">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h4 className="text-[13px] font-semibold text-foreground">Аномалии</h4>
        {anomalies.length === 0 ? (
          <p className="mt-2 text-[13px] text-subtle">Аномалий не обнаружено (или недостаточно данных — нужно 4+ дней истории).</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {anomalies.map((anomaly, index) => (
              <li key={index} className="text-[13px] text-foreground">
                {anomaly.metricLabel}: {formatDate(new Date(anomaly.date))} — {anomaly.value.toFixed(0)} против среднего{" "}
                {anomaly.average.toFixed(0)} ({anomaly.changePercent >= 0 ? "+" : ""}
                {anomaly.changePercent.toFixed(0)}%)
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
