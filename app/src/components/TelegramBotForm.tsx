"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { saveTelegramBotTokenAction, removeTelegramBotTokenAction } from "@/app/panel/connections/actions";

export function TelegramBotForm({
  hasToken,
  verified,
}: {
  hasToken: boolean;
  verified: boolean;
}) {
  const [editing, setEditing] = useState(!hasToken);
  const [showToken, setShowToken] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveTelegramBotTokenAction(botToken);
        setBotToken("");
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить токен");
      }
    });
  }

  function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await removeTelegramBotTokenAction();
        setEditing(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось удалить токен");
        setConfirmingRemove(false);
      }
    });
  }

  if (!editing && hasToken) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-semibold ${
            verified ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"
          }`}
        >
          {verified ? (
            <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {verified ? "Бот подключён и проверен" : "Токен сохранён, но не прошёл проверку"}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Заменить
          </button>
          <button
            type="button"
            onClick={handleRemove}
            onBlur={() => setConfirmingRemove(false)}
            disabled={isPending}
            className={`cursor-pointer rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
              confirmingRemove
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            {isPending ? "…" : confirmingRemove ? "Точно удалить?" : "Удалить"}
          </button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type={showToken ? "text" : "password"}
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:AA..."
          autoComplete="off"
          className="w-full rounded-sm border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setShowToken((v) => !v)}
          aria-label={showToken ? "Скрыть токен" : "Показать токен"}
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {showToken ? (
            <EyeSlashIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !botToken.trim()}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Проверяем…" : "Сохранить и проверить"}
        </button>
        {hasToken ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setBotToken("");
              setError(null);
            }}
            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
          >
            Отмена
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
