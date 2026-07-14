export interface LeadFields {
  destination: string | null;
  people: string | null;
  dates: string | null;
  budget: string | null;
  contact: string | null;
  wishes: string | null;
}

const REQUIRED_FIELDS: Array<keyof LeadFields> = ["destination", "people", "dates", "contact"];
const FIELD_KEYS: Array<keyof LeadFields> = [...REQUIRED_FIELDS, "budget", "wishes"];

export function isLeadComplete(fields: LeadFields): boolean {
  return REQUIRED_FIELDS.every((key) => {
    const value = fields[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export interface AgentReplyContent {
  reply: string;
  fields: LeadFields;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseAgentReplyContent(raw: unknown): AgentReplyContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.reply !== "string") return null;
  if (typeof obj.fields !== "object" || obj.fields === null) return null;
  const fieldsObj = obj.fields as Record<string, unknown>;

  if (!FIELD_KEYS.every((key) => isNullableString(fieldsObj[key]))) return null;

  return {
    reply: obj.reply,
    fields: {
      destination: fieldsObj.destination as string | null,
      people: fieldsObj.people as string | null,
      dates: fieldsObj.dates as string | null,
      budget: fieldsObj.budget as string | null,
      contact: fieldsObj.contact as string | null,
      wishes: fieldsObj.wishes as string | null,
    },
  };
}
