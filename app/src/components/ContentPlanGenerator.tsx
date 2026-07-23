"use client";

import { useState, useTransition } from "react";
import { generateContentPlanAction } from "@/app/panel/content/actions";
import type { Horizon } from "@/lib/contentPlan";

export function ContentPlanGenerator() {
  const [horizon, setHorizon] = useState<Horizon>("week");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateContentPlanAction({ horizon });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сгенерировать план");
      }
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Горизонт</span>
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as Horizon)}
            disabled={isPending}
            className="rounded-sm border border-border bg-background px-3 py-2 text-[13.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          >
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Генерирую план…" : "Сгенерировать план"}
        </button>
      </div>
      {isPending ? (
        <p className="mt-2 text-[12.5px] text-subtle">Модель составляет план — это может занять до минуты.</p>
      ) : null}
      {error ? <p className="mt-2 text-[12.5px] text-destructive">{error}</p> : null}
    </div>
  );
}
