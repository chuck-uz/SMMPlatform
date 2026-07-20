import { parseInsightsContent, type InsightsContent } from "./accountInsights";
import { complete } from "./llm";
import { resolveInteraction, type InteractionOverride } from "./llm/resolve";
import { extractJsonObject } from "./llm/structuredOutput";

const MAX_TOKENS = 3072;

const SHAPE =
  '{"summary": "...", "observations": ["..."], "gaps": ["..."], "direction": "...", "recommendations": ["..."]}';

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

export async function analyzeAccountInsights(
  prompt: string,
  override?: InteractionOverride,
): Promise<InsightsContent> {
  const resolved = await resolveInteraction("analytics", override);

  const outcome = await complete({
    provider: resolved.provider,
    model: resolved.model,
    apiKey: resolved.apiKey,
    supportsStructuredOutputs: resolved.supportsStructuredOutputs,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: MAX_TOKENS,
    schema: INSIGHTS_OUTPUT_SCHEMA,
    schemaName: "account_insights",
    shape: SHAPE,
    parse: (text) => parseInsightsContent(extractJsonObject(text)),
  });

  console.log(
    `[claudeInsightsClient] ${resolved.provider}/${resolved.model} mechanism=${outcome.mechanism} ` +
      `retries=${outcome.retries} ${outcome.latencyMs}ms output_tokens=${outcome.outputTokens}`,
  );

  return outcome.value;
}
