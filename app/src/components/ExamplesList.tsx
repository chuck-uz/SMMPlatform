"use client";

import { useTransition } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { deleteExampleDialogueAction } from "@/app/panel/scenarios/actions";
import type { DialogueTurn } from "@/lib/agentPrompt";

export interface ExampleDialogueItem {
  id: string;
  turns: DialogueTurn[];
}

export function ExamplesList({ examples }: { examples: ExampleDialogueItem[] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteExampleDialogueAction(id);
    });
  }

  if (examples.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-card p-5 text-sm text-subtle">
        Примеров пока нет — сохраните удачный диалог из песочницы ниже.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {examples.map((example, index) => (
        <div key={example.id} className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
              Пример {index + 1}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(example.id)}
              disabled={isPending}
              aria-label="Удалить пример"
              className="cursor-pointer rounded-sm p-1.5 text-subtle transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {example.turns.map((turn, turnIndex) => (
              <p key={turnIndex} className="text-[13px] leading-relaxed">
                <span className="font-semibold text-foreground">
                  {turn.role === "client" ? "Клиент: " : "Агент: "}
                </span>
                <span className="text-muted-foreground">{turn.content}</span>
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
