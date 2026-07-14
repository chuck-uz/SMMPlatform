import { parseAnalysisContent, type AnalysisContent } from "./analysisReport";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Ты аналитик SMM, разбирающий сводку метрик Instagram-аккаунта турагентства.
Тебе передают JSON со сводкой за период: изменения ключевых метрик к прошлому периоду, лучшие и худшие публикации, паттерны по дню недели и времени суток, аномалии.

Правила:
- Опирайся ТОЛЬКО на цифры и факты из присланного JSON. Никогда не придумывай метрики, даты, публикации или значения, которых нет во входных данных.
- Если раздел сводки пуст (пустой массив) — явно скажи, что данных недостаточно для вывода по этому разделу, не додумывай.
- Пиши по-русски, конкретно и по делу; каждое наблюдение должно ссылаться на реальную цифру из сводки.
- Никогда не используй в тексте технические названия полей JSON и программные термины (current, previous, changePercent, topMedia, bottomMedia, weekdayPattern, timeOfDayPattern, anomalies и т.п.) — переводи их в обычные формулировки на человеческом языке ("выросло с X до Y", "данных недостаточно").
- Ответ должен строго соответствовать переданной JSON-схеме.`;

const ANALYSIS_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Общая картина за период, 2-3 предложения" },
    observations: {
      type: "array",
      items: { type: "string" },
      description: "Конкретные наблюдения, каждое со ссылкой на цифру из сводки",
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Конкретные, выполнимые рекомендации",
    },
  },
  required: ["summary", "observations", "recommendations"],
  additionalProperties: false,
};

export async function analyzeSummary(apiKey: string, prompt: string): Promise<AnalysisContent> {
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
      output_config: { format: { type: "json_schema", schema: ANALYSIS_OUTPUT_SCHEMA } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)?.find(
    (block) => block.type === "text",
  );
  const parsed = parseAnalysisContent(textBlock?.text ? JSON.parse(textBlock.text) : null);

  if (!parsed) {
    throw new Error("Claude returned a response that did not match the expected analysis schema");
  }

  return parsed;
}
