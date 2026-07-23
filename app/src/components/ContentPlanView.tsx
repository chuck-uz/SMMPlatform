"use client";

import { useState, useTransition } from "react";
import { deletePlanAction, updatePlanItemAction } from "@/app/panel/content/actions";

export interface PlanItemView {
  id: string;
  slotDate: string;
  rubric: string;
  idea: string;
  captionDraft: string;
  hashtags: string;
  format: string;
  edited: boolean;
}

export interface PlanView {
  id: string;
  horizon: string;
  startDate: string;
  rationale: string;
  provider: string;
  model: string;
  createdAt: string;
  items: PlanItemView[];
}

const FORMAT_LABELS: Record<string, string> = { photo: "Фото", carousel: "Карусель", reels: "Reels" };

const inputClass =
  "w-full rounded-sm border border-border bg-background px-3 py-2 text-[13.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
}

function PlanItemRow({ item }: { item: PlanItemView }) {
  const [idea, setIdea] = useState(item.idea);
  const [captionDraft, setCaptionDraft] = useState(item.captionDraft);
  const [hashtags, setHashtags] = useState(item.hashtags);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = idea !== item.idea || captionDraft !== item.captionDraft || hashtags !== item.hashtags;

  function handleSave() {
    setNotice(null);
    startTransition(async () => {
      try {
        await updatePlanItemAction({ itemId: item.id, idea, captionDraft, hashtags });
        setNotice("Сохранено");
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <div className="border-t border-border px-4 py-3.5 first:border-t-0">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-medium text-foreground">{formatDate(item.slotDate)}</span>
        <span className="rounded-sm bg-muted px-2 py-0.5 text-subtle">{FORMAT_LABELS[item.format] ?? item.format}</span>
        {item.rubric ? <span className="text-subtle">· {item.rubric}</span> : null}
        {item.edited ? <span className="text-accent-hover">· изменено</span> : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">Идея</span>
        <input value={idea} onChange={(e) => setIdea(e.target.value)} className={inputClass} />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">Черновик подписи</span>
        <textarea rows={3} value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} className={inputClass} />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">Хэштеги</span>
        <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={`${inputClass} font-mono text-[12.5px]`} />
      </label>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !dirty}
          className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "…" : "Сохранить"}
        </button>
        {notice ? <span className="text-[12px] text-subtle">{notice}</span> : null}
      </div>
    </div>
  );
}

export function ContentPlanView({ plan }: { plan: PlanView }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePlanAction(plan.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось удалить план");
      }
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
        <div>
          <div className="text-[13.5px] font-medium text-foreground">
            План на {plan.horizon === "month" ? "месяц" : "неделю"} · {plan.items.length} публикаций
          </div>
          <div className="mt-0.5 text-[12px] text-subtle">
            {new Date(plan.createdAt).toLocaleString("ru-RU")} · {plan.provider}/{plan.model}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-[12.5px] text-subtle transition-colors hover:text-destructive disabled:opacity-60"
        >
          {isPending ? "…" : "Удалить"}
        </button>
      </div>

      {plan.rationale ? (
        <p className="border-t border-border px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {plan.rationale}
        </p>
      ) : null}

      {error ? <p className="px-4 py-2 text-[12.5px] text-destructive">{error}</p> : null}

      <div className="border-t border-border">
        {plan.items.map((item) => (
          <PlanItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
