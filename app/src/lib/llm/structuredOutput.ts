import { parseAgentReplyContent, type AgentReplyContent } from "../leadFields";

// How a given provider/model can be made to return the {reply, fields} object:
//   native_schema — the decoder is constrained by a JSON Schema (Anthropic, capable OpenRouter models)
//   json_mode     — the model promises valid JSON but no particular shape (DeepSeek)
//   prompt        — nothing is enforced; we ask in the prompt and parse defensively
export type OutputMechanism = "native_schema" | "json_mode" | "prompt";

export interface MechanismInput {
  provider: string;
  // Reported by the OpenRouter catalog per model; unknown means "assume it cannot".
  supportsStructuredOutputs?: boolean;
}

export function pickOutputMechanism({ provider, supportsStructuredOutputs }: MechanismInput): OutputMechanism {
  switch (provider) {
    case "anthropic":
      return "native_schema";
    case "deepseek":
      return "json_mode";
    case "openrouter":
      return supportsStructuredOutputs ? "native_schema" : "prompt";
    default:
      return "prompt";
  }
}

const SHAPE =
  '{"reply": "<текст ответа клиенту>", "fields": {"destination": null, "people": null, ' +
  '"dates": null, "budget": null, "contact": null, "wishes": null}}';

// `shape` defaults to the lead-reply object used by the agent and comment replies; the
// analytics call site passes its own, since it expects a different structure.
export function buildStructuredOutputInstruction(mechanism: OutputMechanism, shape: string = SHAPE): string {
  // The decoder already guarantees the shape — extra instructions would only waste tokens.
  if (mechanism === "native_schema") return "";

  return (
    "Отвечай ТОЛЬКО одним объектом JSON, без пояснений и без markdown-разметки. " +
    `Форма объекта: ${shape}. ` +
    "Если значение поля неизвестно, ставь null и ничего не выдумывай."
  );
}

export function buildRepairInstruction(shape: string = SHAPE): string {
  return (
    "Предыдущий ответ не удалось разобрать. Верни СТРОГО один объект JSON указанной формы " +
    `(${shape}) — без преамбулы, без markdown и без текста после объекта. Ответ держи коротким.`
  );
}

// Pulls the first complete JSON object out of a model response. Weaker models wrap the
// object in prose ("Конечно, вот ответ: …") or markdown fences, so locating the object by
// brace balance is more forgiving than JSON.parse on the whole string — while still
// refusing anything truncated.
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;

  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

// Structural validation is not enough. Observed on prod: Opus 4.8 returned a schema-valid
// object whose `reply` was `,чтоields":{` — a fragment of the JSON envelope — using 311 of
// 4096 tokens, so the truncation guard had nothing to catch. Without this check that string
// would have been sent to a customer verbatim.
//
// Deliberately conservative: a false positive silently blocks a good answer, so each rule
// targets something no ordinary sentence contains.
export function looksLikeGarbledReply(reply: string): boolean {
  const text = reply.trim();

  // Nothing to say, or nothing resembling words.
  if (!/\p{L}/u.test(text)) return true;

  // Our own envelope keys leaking into the visible text.
  if (/"?(reply|fields)"?\s*:/i.test(text)) return true;
  if (/(eply|ields)"\s*:/.test(text)) return true;

  // JSON key-value punctuation: `":{`, `":[`, `":"`.
  if (/"\s*:\s*[{["]/.test(text)) return true;

  // No sentence opens with these.
  if (/^[,}\]:]/.test(text)) return true;

  return false;
}

export function parseStructuredReply(text: string | null | undefined): AgentReplyContent | null {
  if (!text) return null;

  const parsed = parseAgentReplyContent(extractJsonObject(text));
  if (!parsed) return null;

  // Reported as "unparsed" on purpose: that is what triggers the existing repair retry,
  // and then an honest failure rather than a garbled message to the client.
  if (looksLikeGarbledReply(parsed.reply)) return null;

  return parsed;
}

export interface RepairDecisionInput {
  attempt: number;
  parsed: unknown | null;
  truncated: boolean;
}

// Exactly one repair attempt. A model that cannot comply on the second try is a model we
// want to see failing in the comparison table, not one we keep paying for in a loop.
export function shouldRepairRetry({ attempt, parsed, truncated }: RepairDecisionInput): boolean {
  if (attempt > 0) return false;
  return parsed === null || truncated;
}
