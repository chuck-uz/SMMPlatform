import { parseGrowthContent, type GrowthInsightContent } from "./growthInsights";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Ты стратег по росту Instagram-аккаунта турагентства.
Тебе передают JSON за 90-дневное окно: вовлечённость по форматам публикаций, тренд охвата (первая половина окна против второй) и сигнал спроса по направлениям из заявок (если есть).

Правила:
- Опирайся ТОЛЬКО на цифры и факты из присланного JSON. Никогда не придумывай форматы, значения или направления, которых нет во входных данных.
- Если какого-то раздела входных данных не хватает для вывода — прямо скажи об этом простыми словами ("данных по форматам публикаций пока недостаточно", "охват пока не отслежен за два сопоставимых периода", "заявок пока нет") в соответствующей части ответа, не додумывай.
- Пиши по-русски, конкретно и по делу; каждое узкое место должно ссылаться на реальную цифру из входных данных.
- Никогда не используй в тексте технические названия полей JSON и программные термины (formatBreakdown, reachTrend, sufficientData, firstHalfAverage, secondHalfAverage, demandSignal, destinationCounts, isDeclining и т.п.) — только обычные человеческие формулировки.
- Ответ должен строго соответствовать переданной JSON-схеме.`;

const GROWTH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    bottlenecks: {
      type: "array",
      items: { type: "string" },
      description: "Узкие места, каждое со ссылкой на цифру из входных данных",
    },
    direction: { type: "string", description: "Рекомендация по позиционированию и направлению аккаунта, 2-4 предложения" },
    growthPriorities: {
      type: "array",
      items: { type: "string" },
      description: "Приоритеты роста, от самого важного к менее важному",
    },
  },
  required: ["bottlenecks", "direction", "growthPriorities"],
  additionalProperties: false,
};

export async function analyzeGrowth(apiKey: string, prompt: string): Promise<GrowthInsightContent> {
  const response = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: GROWTH_OUTPUT_SCHEMA } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseGrowthContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude returned a response that did not match the expected growth insight schema");
  }

  return parsed;
}
