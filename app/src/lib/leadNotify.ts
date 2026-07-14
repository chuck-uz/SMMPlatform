import type { LeadFields } from "./leadFields";

export interface LeadNotificationInput extends LeadFields {
  source: string;
}

const SOURCE_LABELS: Record<string, string> = {
  sandbox: "песочница",
  direct: "директ",
  comment: "комментарий",
  site: "сайт",
};

export function buildLeadNotificationText(lead: LeadNotificationInput): string {
  const sourceLabel = SOURCE_LABELS[lead.source] ?? lead.source;

  return [
    `🆕 Новая заявка (источник: ${sourceLabel})`,
    `Направление: ${lead.destination || "—"}`,
    `Люди: ${lead.people || "—"}`,
    `Даты: ${lead.dates || "—"}`,
    `Бюджет: ${lead.budget || "—"}`,
    `Контакт: ${lead.contact || "—"}`,
    `Пожелания: ${lead.wishes || "—"}`,
  ].join("\n");
}
