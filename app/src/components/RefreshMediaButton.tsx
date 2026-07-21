"use client";

import { useState, useTransition } from "react";
import { refreshAccountMediaAction } from "@/app/panel/connections/actions";

export function RefreshMediaButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      try {
        const { upserted, deleted } = await refreshAccountMediaAction(accountId);
        const parts = [`синхронизировано ${upserted}`];
        if (deleted > 0) parts.push(`удалено ${deleted}`);
        setMessage({ text: `Готово: ${parts.join(", ")}.`, tone: "ok" });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : "Не удалось обновить посты",
          tone: "error",
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
        {isPending ? "Обновляю…" : "Обновить посты"}
      </button>
      {message ? (
        <p
          className={`max-w-[620px] text-[11.5px] leading-relaxed ${
            message.tone === "error" ? "text-destructive" : "text-accent-hover"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
