"use client";

import { useState, useTransition } from "react";
import { saveContentStrategyAction } from "@/app/panel/content/actions";
import { CONTENT_FORMATS, type StrategyInput } from "@/lib/contentPlan";

const FORMAT_LABELS: Record<string, string> = {
  photo: "Фото",
  carousel: "Карусель",
  reels: "Reels",
};

const inputClass =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-[13.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent";

export function ContentStrategyForm({ initial }: { initial: StrategyInput }) {
  const [brandVoice, setBrandVoice] = useState(initial.brandVoice);
  const [audience, setAudience] = useState(initial.audience);
  const [goal, setGoal] = useState(initial.goal);
  const [seasonal, setSeasonal] = useState(initial.seasonal);
  const [avoidTopics, setAvoidTopics] = useState(initial.avoidTopics);
  const [postsPerWeek, setPostsPerWeek] = useState(String(initial.postsPerWeek));
  const [pillars, setPillars] = useState(
    initial.pillars.length ? initial.pillars : [{ name: "", description: "" }],
  );
  const [formats, setFormats] = useState<string[]>(initial.formats);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleFormat(format: string) {
    setFormats((prev) => (prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]));
  }

  function handleSave() {
    setNotice(null);
    startTransition(async () => {
      try {
        await saveContentStrategyAction({
          brandVoice,
          audience,
          goal,
          seasonal,
          avoidTopics,
          postsPerWeek: Number(postsPerWeek) || 1,
          pillars: pillars.filter((p) => p.name.trim()),
          formats,
        });
        setNotice("Сохранено");
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <p className="mb-4 text-[12.5px] text-subtle">
        Все поля необязательны — что не заполнено, модель придумает сама. Чем точнее стратегия, тем
        осмысленнее план.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Тон и голос бренда</span>
          <textarea rows={2} value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Аудитория</span>
          <textarea rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Цель ведения</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass} placeholder="Например: заявки на туры" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Сезон / акцент</span>
          <input value={seasonal} onChange={(e) => setSeasonal(e.target.value)} className={inputClass} placeholder="Например: осень, бархатный сезон" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Не затрагивать</span>
          <input value={avoidTopics} onChange={(e) => setAvoidTopics(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted-foreground">Публикаций в неделю</span>
          <input
            type="number"
            min={1}
            max={14}
            value={postsPerWeek}
            onChange={(e) => setPostsPerWeek(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-[12.5px] text-muted-foreground">Рубрики (контент-столпы)</span>
        <div className="flex flex-col gap-2">
          {pillars.map((pillar, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                value={pillar.name}
                onChange={(e) =>
                  setPillars((prev) => prev.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)))
                }
                placeholder="Название"
                className={`${inputClass} sm:max-w-[220px]`}
              />
              <input
                value={pillar.description}
                onChange={(e) =>
                  setPillars((prev) => prev.map((p, i) => (i === index ? { ...p, description: e.target.value } : p)))
                }
                placeholder="Описание (необязательно)"
                className={`${inputClass} sm:flex-1`}
              />
              <button
                type="button"
                onClick={() => setPillars((prev) => prev.filter((_, i) => i !== index))}
                className="cursor-pointer rounded-sm border border-border px-2.5 text-[13px] text-subtle transition-colors hover:text-destructive"
                aria-label="Удалить рубрику"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPillars((prev) => [...prev, { name: "", description: "" }])}
          className="mt-2 cursor-pointer text-[12.5px] text-accent-hover hover:underline"
        >
          + Добавить рубрику
        </button>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-[12.5px] text-muted-foreground">Допустимые форматы</span>
        <div className="flex flex-wrap gap-2">
          {CONTENT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => toggleFormat(format)}
              className={`cursor-pointer rounded-sm border px-3 py-1.5 text-[13px] transition-colors ${
                formats.includes(format)
                  ? "border-accent bg-accent/10 text-accent-hover"
                  : "border-border text-subtle hover:text-foreground"
              }`}
            >
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Сохраняю…" : "Сохранить стратегию"}
        </button>
        {notice ? <span className="text-[12.5px] text-subtle">{notice}</span> : null}
      </div>
    </div>
  );
}
