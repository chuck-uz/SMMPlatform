"use client";

import { useState, useTransition } from "react";
import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/outline";
import {
  discardSandboxSessionAction,
  rateSandboxTurnAction,
  saveSandboxSessionAsExampleAction,
  sendSandboxMessageAction,
} from "@/app/panel/scenarios/actions";
import { canSaveAsExample, type SandboxTurn } from "@/lib/agentSandbox";

export function SandboxChat({
  initialSessionId,
  initialTurns,
}: {
  initialSessionId: string | null;
  initialTurns: SandboxTurn[];
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [turns, setTurns] = useState<SandboxTurn[]>(initialTurns);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = canSaveAsExample(turns);

  function handleSend() {
    if (!message.trim()) return;
    setError(null);
    const text = message;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await sendSandboxMessageAction({ sessionId, message: text });
        setSessionId(result.sessionId);
        setTurns(result.turns);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось получить ответ агента");
      }
    });
  }

  function handleRate(turnIndex: number, rating: "up" | "down") {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await rateSandboxTurnAction({ sessionId, turnIndex, rating });
      setTurns(result.turns);
    });
  }

  function handleSaveAsExample() {
    if (!sessionId) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveSandboxSessionAsExampleAction(sessionId);
        setSessionId(null);
        setTurns([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить пример");
      }
    });
  }

  function handleDiscard() {
    if (!sessionId) {
      setTurns([]);
      return;
    }
    startTransition(async () => {
      await discardSandboxSessionAction(sessionId);
      setSessionId(null);
      setTurns([]);
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-card shadow-card">
      <div className="flex min-h-[220px] flex-col gap-3 p-5">
        {turns.length === 0 ? (
          <p className="text-sm text-subtle">
            Напишите сообщение от лица клиента, чтобы проверить, как ответит агент.
          </p>
        ) : (
          turns.map((turn, index) => (
            <div key={index} className={`flex ${turn.role === "client" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-[12px] px-3.5 py-2 text-[13.5px] leading-relaxed ${
                  turn.role === "client"
                    ? "bg-accent/10 text-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p>{turn.content}</p>
                {turn.role === "agent" ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRate(index, "up")}
                      aria-label="Хороший ответ"
                      className={`cursor-pointer rounded-sm p-1 transition-colors duration-200 ${
                        turn.rating === "up"
                          ? "bg-accent/20 text-accent"
                          : "text-subtle hover:bg-accent/10 hover:text-accent"
                      }`}
                    >
                      <HandThumbUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(index, "down")}
                      aria-label="Плохой ответ"
                      className={`cursor-pointer rounded-sm p-1 transition-colors duration-200 ${
                        turn.rating === "down"
                          ? "bg-destructive/20 text-destructive"
                          : "text-subtle hover:bg-destructive/10 hover:text-destructive"
                      }`}
                    >
                      <HandThumbDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Сообщение от лица клиента…"
            className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || !message.trim()}
            className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "…" : "Отправить"}
          </button>
        </div>

        {turns.length > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAsExample}
              disabled={isPending || !canSave}
              title={!canSave ? "Есть ответ агента с 👎 — исправьте или отбросьте диалог" : undefined}
              className="cursor-pointer rounded-sm border border-accent px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-200 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сохранить диалог как пример
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isPending}
              className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
            >
              Отбросить диалог
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
