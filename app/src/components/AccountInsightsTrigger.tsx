"use client";

import { useState, useTransition } from "react";
import { runManualInsightsAction } from "@/app/panel/analytics/actions";

export function AccountInsightsTrigger({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await runManualInsightsAction({ accountId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось выполнить разбор");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-[10px] bg-accent px-5 py-[9px] text-sm font-semibold text-accent-foreground shadow-card transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Разбираю…" : "Разобрать с помощью AI"}
      </button>
      {error && <p className="mt-2 text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}
