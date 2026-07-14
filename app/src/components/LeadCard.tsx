"use client";

import { useTransition } from "react";
import { updateLeadStatusAction } from "@/app/panel/leads/actions";

export interface LeadCardData {
  id: string;
  destination: string | null;
  people: string | null;
  dates: string | null;
  budget: string | null;
  contact: string | null;
  wishes: string | null;
  completeness: string;
  status: string;
  source: string;
  createdAt: Date;
}

const SOURCE_LABELS: Record<string, string> = {
  sandbox: "Песочница",
  direct: "Директ",
  comment: "Комментарий",
  site: "Сайт",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  closed: "Закрыта",
};

type LeadTextField = "destination" | "people" | "dates" | "budget" | "contact" | "wishes";

const FIELD_LABELS: Record<LeadTextField, string> = {
  destination: "Направление",
  people: "Люди",
  dates: "Даты",
  budget: "Бюджет",
  contact: "Контакт",
  wishes: "Пожелания",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function LeadCard({ lead }: { lead: LeadCardData }) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: "in_progress" | "closed") {
    startTransition(async () => {
      await updateLeadStatusAction(lead.id, status);
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-[10px] py-1 text-xs font-semibold ${
              lead.status === "closed"
                ? "bg-muted text-muted-foreground"
                : lead.status === "in_progress"
                  ? "bg-accent/10 text-accent-hover"
                  : "bg-warning/10 text-warning"
            }`}
          >
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-[10px] py-1 text-xs font-semibold ${
              lead.completeness === "complete" ? "bg-accent/10 text-accent-hover" : "bg-muted text-muted-foreground"
            }`}
          >
            {lead.completeness === "complete" ? "Заявка полная" : "Частичная"}
          </span>
          <span className="text-[11.5px] text-subtle">{SOURCE_LABELS[lead.source] ?? lead.source}</span>
        </div>
        <span className="text-[11.5px] text-subtle">{formatDate(lead.createdAt)}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {(Object.keys(FIELD_LABELS) as LeadTextField[]).map((key) => (
          <div key={key}>
            <dt className="text-[11px] text-subtle">{FIELD_LABELS[key]}</dt>
            <dd className="truncate text-[13px] text-foreground">{lead[key] || "—"}</dd>
          </div>
        ))}
      </dl>

      {lead.status !== "closed" ? (
        <div className="mt-4 flex items-center gap-3">
          {lead.status === "new" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("in_progress")}
              disabled={isPending}
              className="cursor-pointer rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Взять в работу
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleStatusChange("closed")}
            disabled={isPending}
            className="cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Закрыть
          </button>
        </div>
      ) : null}
    </div>
  );
}
