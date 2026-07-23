// Pure helpers for the AI content plan (CT5). No DB, no LLM calls — those live in the
// client and actions. Keeping the date math, output parsing and prompt assembly here makes
// the risky parts unit-testable without a model or a database.

export const CONTENT_FORMATS = ["photo", "carousel", "reels"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export type Horizon = "week" | "month";

export interface StrategyInput {
  brandVoice: string;
  audience: string;
  goal: string;
  seasonal: string;
  avoidTopics: string;
  postsPerWeek: number;
  pillars: Array<{ name: string; description: string }>;
  formats: string[];
}

export interface ParsedPlanItem {
  rubric: string;
  idea: string;
  captionDraft: string;
  hashtags: string;
  format: ContentFormat;
}

export interface ParsedPlan {
  rationale: string;
  items: ParsedPlanItem[];
}

// Evenly spreads the cadence's posts across the horizon window (a week = 7 days, a month =
// a fixed 28-day / 4-week window so the count is predictable rather than 28–31). Dates are
// computed by us, not the model, so slots are always valid and in order — the model only
// fills the content of each slot.
export function buildPlanSlots(params: {
  horizon: Horizon;
  startDate: Date;
  postsPerWeek: number;
}): Date[] {
  const weeks = params.horizon === "month" ? 4 : 1;
  const windowDays = weeks * 7;
  const total = Math.max(1, Math.floor(params.postsPerWeek)) * weeks;

  const slots: Date[] = [];
  for (let i = 0; i < total; i++) {
    const dayOffset = Math.floor((i * windowDays) / total);
    const date = new Date(params.startDate);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    slots.push(date);
  }
  return slots;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeFormat(value: unknown): ContentFormat {
  return (CONTENT_FORMATS as readonly string[]).includes(value as string)
    ? (value as ContentFormat)
    : "photo";
}

// Validates the model's structured output. Individual junk items are skipped (a single
// malformed row must not sink an otherwise-usable plan), but a response with no usable item
// at all — or a non-object — returns null so the caller can trigger the repair retry.
export function parseContentPlan(raw: unknown): ParsedPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return null;

  const items: ParsedPlanItem[] = [];
  for (const entry of obj.items) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    items.push({
      rubric: asString(item.rubric),
      idea: asString(item.idea),
      captionDraft: asString(item.caption ?? item.captionDraft),
      hashtags: asString(item.hashtags),
      format: normalizeFormat(item.format),
    });
  }

  if (items.length === 0) return null;
  return { rationale: asString(obj.rationale), items };
}

function line(label: string, value: string): string {
  return value.trim() ? `- ${label}: ${value.trim()}\n` : "";
}

// Assembles the instruction sent to the model. Every strategy knob is optional; an empty one
// is simply omitted, so the model fills the gap itself rather than seeing a blank directive.
// The exact slot count is stated so the model returns one item per slot we computed.
export function buildContentPlanPrompt(params: {
  strategy: StrategyInput;
  horizon: Horizon;
  slotCount: number;
  grounding: string;
}): string {
  const { strategy, horizon, slotCount, grounding } = params;
  const horizonWord = horizon === "month" ? "месяц" : "неделю";

  const pillars = strategy.pillars
    .filter((p) => p.name.trim())
    .map((p) => `  • ${p.name.trim()}${p.description.trim() ? ` — ${p.description.trim()}` : ""}`)
    .join("\n");
  const formats = strategy.formats.filter((f) => f.trim()).join(", ");

  let prompt = `Ты — SMM-стратег турагентства. Составь контент-план на ${horizonWord}.\n\n`;
  prompt += `Верни ровно ${slotCount} публикаций — по одной на каждый запланированный слот, в том же порядке.\n\n`;

  prompt += "Стратегия бренда:\n";
  prompt += line("Тон и голос", strategy.brandVoice);
  prompt += line("Аудитория", strategy.audience);
  prompt += line("Цель", strategy.goal);
  prompt += line("Сезон/акцент", strategy.seasonal);
  prompt += line("Не затрагивать", strategy.avoidTopics);
  if (pillars) prompt += `- Рубрики:\n${pillars}\n`;
  if (formats) prompt += line("Допустимые форматы", formats);

  if (grounding.trim()) {
    prompt += `\nДанные аккаунта (используй как обоснование):\n${grounding.trim()}\n`;
  }

  prompt +=
    "\nДля каждой публикации дай: рубрику, идею, черновик подписи (готовый к правке), хэштеги и формат " +
    "(photo, carousel или reels). В поле rationale — короткое обоснование логики плана.";

  return prompt;
}
