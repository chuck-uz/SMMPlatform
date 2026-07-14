import type { PeriodSummary } from "@/lib/analyticsSummary";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function MediaListItem({ caption, postedAt, totalInteractions }: { caption: string | null; postedAt: Date; totalInteractions: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-[13px] first:border-t-0">
      <span className="min-w-0 truncate text-foreground">{caption || "Без подписи"}</span>
      <span className="shrink-0 text-subtle">{formatDate(postedAt)}</span>
      <span className="shrink-0 font-semibold text-foreground">{formatNumber(totalInteractions)}</span>
    </div>
  );
}

export function SummaryPanel({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="max-w-[1020px] space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summary.metricDeltas.map((delta) => (
          <div key={delta.key} className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">{delta.label}</div>
            <div className="mt-1.5 text-[19px] font-bold text-foreground">{formatNumber(delta.current)}</div>
            <div
              className={`mt-0.5 text-[12.5px] font-semibold ${
                delta.changePercent === null
                  ? "text-subtle"
                  : delta.changePercent >= 0
                    ? "text-accent-hover"
                    : "text-destructive"
              }`}
            >
              {formatPercent(delta.changePercent)} к прошлому периоду
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h3 className="text-[13px] font-semibold text-foreground">Лучшие публикации</h3>
          {summary.topMedia.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-subtle">Нет постов/Reels за период.</p>
          ) : (
            summary.topMedia.map((media) => (
              <MediaListItem key={media.id} caption={media.caption} postedAt={media.postedAt} totalInteractions={media.totalInteractions} />
            ))
          )}
        </div>
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h3 className="text-[13px] font-semibold text-foreground">Худшие публикации</h3>
          {summary.bottomMedia.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-subtle">Недостаточно публикаций для сравнения.</p>
          ) : (
            summary.bottomMedia.map((media) => (
              <MediaListItem key={media.id} caption={media.caption} postedAt={media.postedAt} totalInteractions={media.totalInteractions} />
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h3 className="text-[13px] font-semibold text-foreground">Паттерн по дню недели</h3>
          {summary.weekdayPattern.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-subtle">
              Пока недостаточно публикаций на день недели (нужно 3+), чтобы выявить паттерн.
            </p>
          ) : (
            summary.weekdayPattern.map((bucket) => (
              <div key={bucket.key} className="flex items-center justify-between border-t border-border py-2 text-[13px] first:border-t-0">
                <span className="text-foreground">{bucket.label}</span>
                <span className="text-subtle">
                  в среднем {formatNumber(bucket.averageInteractions)} · {bucket.sampleSize} публ.
                </span>
              </div>
            ))
          )}
        </div>
        <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h3 className="text-[13px] font-semibold text-foreground">Паттерн по времени суток</h3>
          {summary.timeOfDayPattern.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-subtle">
              Пока недостаточно публикаций на интервал (нужно 3+), чтобы выявить паттерн.
            </p>
          ) : (
            summary.timeOfDayPattern.map((bucket) => (
              <div key={bucket.key} className="flex items-center justify-between border-t border-border py-2 text-[13px] first:border-t-0">
                <span className="text-foreground">{bucket.label}</span>
                <span className="text-subtle">
                  в среднем {formatNumber(bucket.averageInteractions)} · {bucket.sampleSize} публ.
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h3 className="text-[13px] font-semibold text-foreground">Аномалии</h3>
        {summary.anomalies.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-subtle">
            Аномалий не обнаружено (или недостаточно данных за период — нужно 4+ дней истории).
          </p>
        ) : (
          summary.anomalies.map((anomaly, index) => (
            <div key={`${anomaly.metricKey}-${anomaly.date}-${index}`} className="border-t border-border py-2 text-[13px] first:border-t-0">
              <span className="font-semibold text-foreground">{anomaly.metricLabel}</span>{" "}
              <span className="text-subtle">
                {formatDate(anomaly.date)} — {formatNumber(anomaly.value)} (обычно ~{formatNumber(anomaly.average)},{" "}
                {formatPercent(anomaly.changePercent)})
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
