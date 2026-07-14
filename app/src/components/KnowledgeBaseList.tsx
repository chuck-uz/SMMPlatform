"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { addKnowledgeDocumentAction, deleteKnowledgeDocumentAction } from "@/app/panel/scenarios/actions";

export interface KnowledgeDocumentItem {
  id: string;
  title: string;
  body: string;
}

export function KnowledgeBaseList({ documents }: { documents: KnowledgeDocumentItem[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await addKnowledgeDocumentAction({ title, body });
        setTitle("");
        setBody("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось добавить документ");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteKnowledgeDocumentAction(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {documents.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card p-5 text-sm text-subtle">
          База знаний пока пуста — добавьте первый документ ниже.
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card shadow-card">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start justify-between gap-4 border-t border-border px-5 py-3.5 first:border-t-0"
            >
              <div className="min-w-0">
                <h4 className="text-[13.5px] font-semibold text-foreground">{doc.title}</h4>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{doc.body}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                aria-label="Удалить документ"
                className="cursor-pointer rounded-sm p-1.5 text-subtle transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
              >
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h4 className="text-sm font-semibold text-foreground">Добавить документ</h4>
        <div className="mt-3 flex flex-col gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок, например «Турция — пляжный отдых»"
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Условия, каталог, частые вопросы…"
            className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !title.trim() || !body.trim()}
              className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Добавляем…" : "Добавить"}
            </button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
