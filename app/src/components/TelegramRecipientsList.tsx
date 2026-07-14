"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import {
  addTelegramRecipientAction,
  removeTelegramRecipientAction,
  sendTestTelegramMessageAction,
} from "@/app/panel/connections/actions";

export interface TelegramRecipientItem {
  id: string;
  chatId: string;
  label: string | null;
}

export function TelegramRecipientsList({ recipients }: { recipients: TelegramRecipientItem[] }) {
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSendTest() {
    setError(null);
    setTestResult(null);
    startTransition(async () => {
      try {
        const { sent, failed } = await sendTestTelegramMessageAction();
        setTestResult(
          failed === 0
            ? `Отправлено ${sent} из ${sent}`
            : `Отправлено ${sent} из ${sent + failed}, ${failed} не удалось`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось отправить тестовое сообщение");
      }
    });
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await addTelegramRecipientAction({ chatId, label });
        setChatId("");
        setLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось добавить получателя");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await removeTelegramRecipientAction(id);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {recipients.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-background p-4 text-sm text-subtle">
          Получателей пока нет — добавьте chat_id ниже, чтобы уведомления о новых заявках приходили в Telegram.
        </div>
      ) : (
        <>
          <div className="rounded-[10px] border border-border bg-background">
            {recipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-medium text-foreground">{recipient.chatId}</span>
                  {recipient.label ? (
                    <span className="ml-2 text-[12px] text-muted-foreground">{recipient.label}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(recipient.id)}
                  aria-label="Удалить получателя"
                  className="cursor-pointer rounded-sm p-1.5 text-subtle transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isPending}
              className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Отправляем…" : "Отправить тестовое сообщение"}
            </button>
            {testResult ? <span className="text-xs text-accent">{testResult}</span> : null}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="chat_id, например 123456789"
          className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Подпись (необязательно), например «Аслан»"
          className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !chatId.trim()}
          className="cursor-pointer whitespace-nowrap rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Добавить
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
