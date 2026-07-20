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

export function parseStructuredReply(text: string | null | undefined): AgentReplyContent | null {
  if (!text) return null;
  return parseAgentReplyContent(extractJsonObject(text));
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
