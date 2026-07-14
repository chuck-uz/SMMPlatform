"use client";

import { useState, useTransition } from "react";
import { saveAgentConfigAction } from "@/app/panel/scenarios/actions";

export function ScenarioEditor({ initialToneAndRules }: { initialToneAndRules: string }) {
  const [value, setValue] = useState(initialToneAndRules);
  const [savedValue, setSavedValue] = useState(initialToneAndRules);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = value !== savedValue;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAgentConfigAction(value);
        setSavedValue(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить сценарий");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Например: обращаемся на «вы», дружелюбно и по делу, используем эмодзи в меру, не давим на клиента…"
        className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Сохраняем…" : "Сохранить"}
        </button>
        {!isDirty && !isPending ? <span className="text-xs text-subtle">Сохранено</span> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
