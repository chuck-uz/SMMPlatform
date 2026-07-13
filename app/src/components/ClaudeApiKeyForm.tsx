"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { saveClaudeApiKeyAction, removeClaudeApiKeyAction } from "@/app/panel/connections/actions";

export function ClaudeApiKeyForm({
  hasKey,
  verified,
}: {
  hasKey: boolean;
  verified: boolean;
}) {
  const [editing, setEditing] = useState(!hasKey);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveClaudeApiKeyAction(apiKey);
        setApiKey("");
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить ключ");
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
        await removeClaudeApiKeyAction();
        setEditing(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось удалить ключ");
        setConfirmingRemove(false);
      }
    });
  }

  if (!editing && hasKey) {
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
          {verified ? "Ключ подключён и проверен" : "Ключ сохранён, но не прошёл проверку"}
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
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          className="w-full rounded-sm border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          aria-label={showKey ? "Скрыть ключ" : "Показать ключ"}
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {showKey ? (
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
          disabled={isPending || !apiKey.trim()}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Проверяем…" : "Сохранить и проверить"}
        </button>
        {hasKey ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setApiKey("");
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
