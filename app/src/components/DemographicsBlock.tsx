"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgeGenderBar, CountryBar } from "@/lib/analyticsDashboard";

const GENDER_LABELS: Record<string, string> = { F: "Женщины", M: "Мужчины", U: "Не указано" };
const GENDER_COLORS: Record<string, string> = {
  F: "var(--color-accent)",
  M: "var(--color-primary)",
  U: "var(--color-subtle)",
};

export function DemographicsBlock({
  followerCount,
  ageGender,
  countries,
}: {
  followerCount: number | null;
  ageGender: AgeGenderBar[];
  countries: CountryBar[];
}) {
  if (followerCount !== null && followerCount < 100) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
        Демография недоступна: нужно 100+ подписчиков (сейчас {followerCount}).
      </div>
    );
  }

  if (ageGender.length === 0 && countries.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
        Демография ещё не собрана.
      </div>
    );
  }

  const genders = [...new Set(ageGender.flatMap((bar) => Object.keys(bar).filter((k) => k !== "ageGroup")))];
  const topCountries = countries.slice(0, 10);
  const maxCountryValue = Math.max(1, ...topCountries.map((c) => c.value));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h3 className="text-[13px] font-semibold text-foreground">Возраст и пол</h3>
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageGender} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="ageGroup"
                tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-subtle)" }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                formatter={(value, name) => [value, GENDER_LABELS[String(name)] ?? String(name)]}
                contentStyle={{ borderRadius: 10, borderColor: "var(--color-border)", fontSize: 12.5 }}
              />
              <Legend formatter={(name) => GENDER_LABELS[name] ?? name} wrapperStyle={{ fontSize: 12 }} />
              {genders.map((gender) => (
                <Bar key={gender} dataKey={gender} fill={GENDER_COLORS[gender] ?? "var(--color-subtle)"} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h3 className="text-[13px] font-semibold text-foreground">Топ стран</h3>
        <div className="mt-4 space-y-2.5">
          {topCountries.map((country) => (
            <div key={country.country} className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-[12.5px] font-semibold text-muted-foreground">
                {country.country}
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.round((country.value / maxCountryValue) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[12.5px] text-subtle">{country.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
