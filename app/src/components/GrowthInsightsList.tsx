import type { GrowthInsightContent } from "@/lib/growthInsights";

export interface GrowthInsightReportItem {
  id: string;
  trigger: string;
  periodFrom: Date;
  periodTo: Date;
  createdAt: Date;
  content: GrowthInsightContent;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "по запросу",
  digest: "ежемесячный дайджест",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function GrowthInsightsList({ reports }: { reports: GrowthInsightReportItem[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
        Разборов узких мест ещё не было — нажмите «Разобрать узкие места» выше.
      </div>
    );
  }

  const [latest, ...older] = reports;

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
            {formatDate(latest.periodFrom)} — {formatDate(latest.periodTo)} ·{" "}
            {TRIGGER_LABELS[latest.trigger] ?? latest.trigger}
          </span>
          <span className="text-[11.5px] text-subtle">{formatDate(latest.createdAt)}</span>
        </div>

        {latest.content.bottlenecks.length > 0 && (
          <>
            <h4 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-subtle">Узкие места</h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
              {latest.content.bottlenecks.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </>
        )}

        <h4 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-subtle">Направление аккаунта</h4>
        <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">{latest.content.direction}</p>

        {latest.content.growthPriorities.length > 0 && (
          <>
            <h4 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-subtle">Приоритеты роста</h4>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
              {latest.content.growthPriorities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          </>
        )}
      </div>

      {older.length > 0 && (
        <div className="rounded-[14px] border border-border bg-card shadow-card">
          {older.map((report) => (
            <div key={report.id} className="border-t border-border px-5 py-3 first:border-t-0">
              <div className="flex items-center justify-between gap-3 text-[11.5px] text-subtle">
                <span>
                  {formatDate(report.periodFrom)} — {formatDate(report.periodTo)} ·{" "}
                  {TRIGGER_LABELS[report.trigger] ?? report.trigger}
                </span>
                <span>{formatDate(report.createdAt)}</span>
              </div>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">{report.content.direction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
