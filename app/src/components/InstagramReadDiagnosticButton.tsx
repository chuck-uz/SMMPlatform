"use client";

import { useState, useTransition } from "react";
import {
  runInstagramReadDiagnosticAction,
  type InstagramReadDiagnosticResult,
} from "@/app/panel/connections/actions";

export function InstagramReadDiagnosticButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<InstagramReadDiagnosticResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await runInstagramReadDiagnosticAction(accountId));
      } catch (err) {
        setResult({
          ok: false,
          stage: "network",
          error: err instanceof Error ? err.message : "Не удалось выполнить проверку",
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-fit cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Проверяю…" : "Проверить чтение комментариев"}
      </button>
      {result ? (
        <p className={`max-w-[620px] text-[11.5px] leading-relaxed ${toneFor(result)}`}>
          {result.ok ? result.message : networkMessage(result)}
        </p>
      ) : null}
    </div>
  );
}

function toneFor(result: InstagramReadDiagnosticResult): string {
  if (!result.ok) return "text-destructive";
  if (result.verdict === "ok") return "text-accent-hover";
  if (result.verdict === "standard_access_hidden") return "text-warning";
  return "text-subtle";
}

function networkMessage(result: { stage: "network" | "api"; error: string }): string {
  if (result.stage === "network") {
    return `Запрос не дошёл до graph.instagram.com — вероятно, блокировка исходящего трафика с сервера (Meta недоступна из РФ). Детали: ${result.error}`;
  }
  return `Instagram вернул ошибку — проверьте токен и права доступа. Детали: ${result.error}`;
}
