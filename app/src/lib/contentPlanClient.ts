import {
  buildContentPlanPrompt,
  parseContentPlan,
  type Horizon,
  type ParsedPlan,
  type StrategyInput,
} from "./contentPlan";
import { complete } from "./llm";
import { resolveInteraction, type InteractionOverride } from "./llm/resolve";
import { extractJsonObject } from "./llm/structuredOutput";

const MAX_TOKENS = 4096;

const SHAPE =
  '{"rationale": "...", "items": [{"rubric": "...", "idea": "...", "caption": "...", "hashtags": "...", "format": "photo|carousel|reels"}]}';

const SYSTEM_PROMPT = `Ты — SMM-стратег турагентства. Ты составляешь контент-планы для Instagram: осмысленные, разнообразные по рубрикам, с готовыми к правке черновиками подписей.
Правила:
- Возвращай ровно столько публикаций, сколько запрошено, в исходном порядке слотов.
- Подписи пиши по-русски, живо и по делу, без «воды» и кликбейта; каждая — готовый черновик, который менеджер может выложить с минимальной правкой.
- Опирайся на стратегию бренда и, если переданы данные аккаунта, — на них (обоснование клади в rationale).
- Формат каждой публикации — строго одно из: photo, carousel, reels.
- Ответ строго соответствует переданной JSON-схеме.`;

const CONTENT_PLAN_SCHEMA = {
  type: "object",
  properties: {
    rationale: { type: "string", description: "Короткое обоснование логики плана" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rubric: { type: "string", description: "Рубрика/контент-столп публикации" },
          idea: { type: "string", description: "Идея публикации в одну фразу" },
          caption: { type: "string", description: "Черновик подписи, готовый к правке" },
          hashtags: { type: "string", description: "Хэштеги через пробел" },
          format: { type: "string", enum: ["photo", "carousel", "reels"] },
        },
        required: ["rubric", "idea", "caption", "hashtags", "format"],
        additionalProperties: false,
      },
    },
  },
  required: ["rationale", "items"],
  additionalProperties: false,
};

export async function generateContentPlan(
  params: {
    strategy: StrategyInput;
    horizon: Horizon;
    slotCount: number;
    grounding: string;
  },
  override?: InteractionOverride,
): Promise<{ plan: ParsedPlan; provider: string; model: string }> {
  const resolved = await resolveInteraction("content_plan", override);

  const prompt = buildContentPlanPrompt({
    strategy: params.strategy,
    horizon: params.horizon,
    slotCount: params.slotCount,
    grounding: params.grounding,
  });

  const outcome = await complete({
    provider: resolved.provider,
    model: resolved.model,
    apiKey: resolved.apiKey,
    supportsStructuredOutputs: resolved.supportsStructuredOutputs,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: MAX_TOKENS,
    schema: CONTENT_PLAN_SCHEMA,
    schemaName: "content_plan",
    shape: SHAPE,
    parse: (text) => parseContentPlan(extractJsonObject(text)),
  });

  console.log(
    `[contentPlanClient] ${resolved.provider}/${resolved.model} mechanism=${outcome.mechanism} ` +
      `retries=${outcome.retries} ${outcome.latencyMs}ms output_tokens=${outcome.outputTokens} items=${outcome.value.items.length}`,
  );

  return { plan: outcome.value, provider: resolved.provider, model: resolved.model };
}
