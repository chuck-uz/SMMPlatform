"use client";

import { useState, useTransition } from "react";
import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/outline";
import {
  discardSandboxSessionAction,
  rateSandboxTurnAction,
  saveSandboxSessionAsExampleAction,
  sendSandboxMessageAction,
} from "@/app/panel/scenarios/actions";
import { canSaveAsExample, DEFAULT_SANDBOX_MODEL, SANDBOX_MODEL_OPTIONS, type SandboxTurn } from "@/lib/agentSandbox";
import { isLeadComplete, type LeadFields } from "@/lib/leadFields";

const EMPTY_LEAD_FIELDS: LeadFields = {
  destination: null,
  people: null,
  dates: null,
  budget: null,
  contact: null,
  wishes: null,
};

const LEAD_FIELD_LABELS: Record<keyof LeadFields, string> = {
  destination: "Направление",
  people: "Люди",
  dates: "Даты",
  budget: "Бюджет",
  contact: "Контакт",
  wishes: "Пожелания",
};

export function SandboxChat({
  initialSessionId,
  initialTurns,
  initialLeadFields,
  initialModel,
}: {
  initialSessionId: string | null;
  initialTurns: SandboxTurn[];
  initialLeadFields: LeadFields;
  initialModel: string;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [turns, setTurns] = useState<SandboxTurn[]>(initialTurns);
  const [leadFields, setLeadFields] = useState<LeadFields>(initialLeadFields);
  const [model, setModel] = useState(initialModel);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = canSaveAsExample(turns);

  function handleSend() {
    // Guard against a concurrent send when Enter is pressed mid-request — the
    // button is disabled while pending but the Enter key bypasses that, which
    // would fork the session and overwrite turns.
    if (isPending) return;
    if (!message.trim()) return;
    setError(null);
    const text = message;
    startTransition(async () => {
      try {
        const result = await sendSandboxMessageAction({ sessionId, message: text, model });
        setSessionId(result.sessionId);
        setTurns(result.turns);
        setLeadFields(result.leadFields);
        // Clear only after a successful send so the typed text isn't lost on error.
        setMessage("");
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
        setLeadFields(EMPTY_LEAD_FIELDS);
        setModel(DEFAULT_SANDBOX_MODEL);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить пример");
      }
    });
  }

  function handleDiscard() {
    if (!sessionId) {
      setTurns([]);
      setLeadFields(EMPTY_LEAD_FIELDS);
      setModel(DEFAULT_SANDBOX_MODEL);
      return;
    }
    startTransition(async () => {
      await discardSandboxSessionAction(sessionId);
      setSessionId(null);
      setTurns([]);
      setLeadFields(EMPTY_LEAD_FIELDS);
      setModel(DEFAULT_SANDBOX_MODEL);
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

      {turns.length > 0 ? (
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
              Извлечённые поля заявки
            </span>
            <span
              className={`inline-flex items-center rounded-full px-[10px] py-1 text-xs font-semibold ${
                isLeadComplete(leadFields) ? "bg-accent/10 text-accent-hover" : "bg-warning/10 text-warning"
              }`}
            >
              {isLeadComplete(leadFields) ? "Заявка полная" : "Частичная"}
            </span>
          </div>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {(Object.keys(LEAD_FIELD_LABELS) as Array<keyof LeadFields>).map((key) => (
              <div key={key}>
                <dt className="text-[11px] text-subtle">{LEAD_FIELD_LABELS[key]}</dt>
                <dd className="truncate text-[13px] text-foreground">{leadFields[key] || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor="sandbox-model" className="text-[11.5px] font-medium text-subtle">
            Модель
          </label>
          <select
            id="sandbox-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isPending}
            className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SANDBOX_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
