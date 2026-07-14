import type { DialogueTurn } from "./agentPrompt";

export interface SandboxTurn extends DialogueTurn {
  rating?: "up" | "down" | null;
}

export function canSaveAsExample(turns: SandboxTurn[]): boolean {
  const agentTurns = turns.filter((turn) => turn.role === "agent");
  if (agentTurns.length === 0) return false;
  return agentTurns.every((turn) => turn.rating !== "down");
}

export function buildExampleDialogueTurns(turns: SandboxTurn[]): DialogueTurn[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }));
}

export const DEFAULT_SANDBOX_MODEL = "claude-haiku-4-5-20251001";

export interface SandboxModelOption {
  id: string;
  label: string;
}

export const SANDBOX_MODEL_OPTIONS: SandboxModelOption[] = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (боевая)" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-sonnet-5", label: "Sonnet 5" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-opus-4-7", label: "Opus 4.7" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
];

export function isValidSandboxModel(modelId: string): boolean {
  return SANDBOX_MODEL_OPTIONS.some((option) => option.id === modelId);
}
