"use client";

import { useState, useTransition } from "react";
import { disconnectInstagramAccountAction } from "@/app/panel/connections/actions";

export function DisconnectInstagramButton({ accountId }: { accountId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await disconnectInstagramAccountAction(accountId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось отключить аккаунт");
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        onBlur={() => setConfirming(false)}
        disabled={isPending}
        className={`cursor-pointer rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          confirming
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-border text-foreground hover:bg-muted"
        }`}
      >
        {isPending ? "…" : confirming ? "Точно отключить?" : "Отключить"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
