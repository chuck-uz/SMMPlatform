"use client";

import { useState, useTransition } from "react";
import { setUserActiveAction } from "@/app/panel/users/actions";

export function UserActiveToggle({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf && isActive) {
    return <span className="text-xs text-muted-foreground">Это ваша учётная запись</span>;
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await setUserActiveAction(userId, !isActive);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось изменить статус");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "…" : isActive ? "Деактивировать" : "Активировать"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
