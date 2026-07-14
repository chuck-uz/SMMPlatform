"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AccountMetricChart } from "@/lib/analyticsDashboard";
import { hasEnoughDataForChart } from "@/lib/analyticsDashboard";

function formatDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

export function AnalyticsCharts({ charts }: { charts: AccountMetricChart[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {charts.map((chart) => (
        <div key={chart.key} className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h3 className="text-[13px] font-semibold text-foreground">{chart.label}</h3>
          {hasEnoughDataForChart(chart.series) ? (
            <div className="mt-3 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatDate(String(label))}
                    contentStyle={{
                      borderRadius: 10,
                      borderColor: "var(--color-border)",
                      fontSize: 12.5,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-accent)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3 flex h-[180px] items-center justify-center rounded-[10px] border border-dashed border-border p-4 text-center text-[12.5px] text-subtle">
              <p>
                Пока недостаточно данных
                <br />
                — соберём график после нескольких дней сбора
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
