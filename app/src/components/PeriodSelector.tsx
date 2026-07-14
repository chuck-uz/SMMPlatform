"use client";

import { useState } from "react";

const PRESET_OPTIONS = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "custom", label: "Свой диапазон" },
];

const fieldLabelClass = "block text-[11.5px] font-semibold uppercase tracking-wide text-subtle";
const fieldClass =
  "mt-1 rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-foreground shadow-card";

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function PeriodSelector({
  accountId,
  preset,
  from,
  to,
}: {
  accountId: string;
  preset: string;
  from?: string;
  to?: string;
}) {
  const [selected, setSelected] = useState(preset);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function handlePeriodChange(value: string) {
    setSelected(value);
    if (value === "custom") {
      const now = new Date();
      setCustomFrom((prev) => prev ?? formatDateInput(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
      setCustomTo((prev) => prev ?? formatDateInput(now));
    }
  }

  return (
    <form action="/panel/analytics" method="GET" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="account" value={accountId} />
      <input type="hidden" name="tab" value="summary" />
      <div>
        <label className={fieldLabelClass}>Период</label>
        <select
          name="period"
          value={selected}
          onChange={(event) => handlePeriodChange(event.target.value)}
          className={fieldClass}
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {selected === "custom" && (
        <>
          <div>
            <label className={fieldLabelClass}>С</label>
            <input
              type="date"
              name="from"
              value={customFrom ?? ""}
              onChange={(event) => setCustomFrom(event.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>По</label>
            <input
              type="date"
              name="to"
              value={customTo ?? ""}
              onChange={(event) => setCustomTo(event.target.value)}
              required
              className={fieldClass}
            />
          </div>
        </>
      )}
      <button
        type="submit"
        className="rounded-[10px] bg-accent px-5 py-[9px] text-sm font-semibold text-accent-foreground shadow-card transition-colors duration-200 hover:bg-accent-hover"
      >
        Сформировать сводку
      </button>
    </form>
  );
}
