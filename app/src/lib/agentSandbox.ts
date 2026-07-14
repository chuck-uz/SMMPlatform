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
