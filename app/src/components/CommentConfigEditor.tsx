"use client";

import { useState, useTransition } from "react";
import { saveCommentConfigAction } from "@/app/panel/scenarios/actions";

export function CommentConfigEditor({
  initialToneAndRules,
  initialModerationEnabled,
}: {
  initialToneAndRules: string;
  initialModerationEnabled: boolean;
}) {
  const [tone, setTone] = useState(initialToneAndRules);
  const [moderationEnabled, setModerationEnabled] = useState(initialModerationEnabled);
  const [saved, setSaved] = useState({ tone: initialToneAndRules, moderationEnabled: initialModerationEnabled });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = tone !== saved.tone || moderationEnabled !== saved.moderationEnabled;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveCommentConfigAction({ commentToneAndRules: tone, commentModerationEnabled: moderationEnabled });
        setSaved({ tone, moderationEnabled });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить настройки комментариев");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        rows={5}
        placeholder="Например: отвечай коротко и дружелюбно, максимум одна фраза, не проси контакт в комментариях…"
        className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={moderationEnabled}
          onChange={(e) => setModerationEnabled(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded-sm border-border accent-accent"
        />
        Модерация ответов (черновики ждут одобрения в «Инбоксе»)
      </label>
      <p className="text-xs text-subtle">
        {moderationEnabled
          ? "Включено: черновики публикуются в Instagram только после вашего одобрения."
          : "Выключено: ответы публикуются в Instagram автоматически, без проверки."}
      </p>

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
