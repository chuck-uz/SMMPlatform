import { parseInsightsContent, type InsightsContent } from "./accountInsights";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Ты аналитик и стратег по росту Instagram-аккаунта турагентства, помогающий менеджеру разобраться, что происходит с аккаунтом и что делать дальше.
Тебе передают JSON за фиксированное 90-дневное окно: тренды по всем ключевым метрикам (первая половина окна против второй), лучшие и худшие публикации, паттерны по дню недели и времени суток, аномалии, вовлечённость по форматам публикаций и сигнал спроса по направлениям из заявок (если есть).

Правила:
- Опирайся ТОЛЬКО на цифры и факты из присланного JSON. Никогда не придумывай метрики, публикации, форматы, направления или значения, которых нет во входных данных.
- Если какого-то раздела входных данных не хватает для вывода — прямо скажи об этом простыми словами ("данных пока недостаточно", "заявок пока нет"), не додумывай.
- Пиши по-русски, конкретно и по делу; каждое наблюдение и пробел должны ссылаться на реальную цифру или факт из входных данных.
- Никогда не используй в тексте технические названия полей JSON и программные термины (metricTrends, sufficientData, firstHalfValue, secondHalfValue, formatBreakdown, demandSignal, destinationCounts, topMedia, bottomMedia, weekdayPattern, timeOfDayPattern, anomalies и т.п.) — только обычные человеческие формулировки.
- Раздел "recommendations" — единый приоритизированный список действий, от самого важного к менее важному, объединяющий и тактические, и стратегические шаги.
- Ответ должен строго соответствовать переданной JSON-схеме.`;

const INSIGHTS_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Общая картина за 90 дней, 2-3 предложения" },
    observations: {
      type: "array",
      items: { type: "string" },
      description: "Конкретные наблюдения, каждое со ссылкой на реальную цифру из входных данных",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "Пробелы — в данных (чего не хватает для выводов) или в самом аккаунте (слабые места)",
    },
    direction: { type: "string", description: "Направление развития аккаунта, 2-4 предложения" },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Единый приоритизированный список действий, от важного к менее важному",
    },
  },
  required: ["summary", "observations", "gaps", "direction", "recommendations"],
  additionalProperties: false,
};

export async function analyzeAccountInsights(apiKey: string, prompt: string): Promise<InsightsContent> {
  const response = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: INSIGHTS_OUTPUT_SCHEMA } },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const detail = bodyText.trim().startsWith("<") ? "upstream returned an error page, not JSON" : bodyText.slice(0, 500);
    throw new Error(`Claude API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseInsightsContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude returned a response that did not match the expected insights schema");
  }

  return parsed;
}
