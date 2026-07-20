import type { LeadFields } from "./leadFields";

export interface ComparisonTarget {
  provider: string;
  model: string;
}

export interface ComparisonResultRow {
  provider: string;
  model: string;
  turnIndex: number;
  reply: string | null;
  fields: LeadFields | null;
  mechanism: string;
  retries: number;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  error?: string | null;
}

// A saved example dialogue holds both sides; only the client's lines form the script that
// every model must answer, so the comparison is driven by identical input.
export function extractClientTurns(turns: Array<{ role: string; content: string }>): string[] {
  return turns
    .filter((turn) => turn.role === "client")
    .map((turn) => turn.content.trim())
    .filter((content) => content.length > 0);
}

export function parseManualTurns(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export interface ComparisonPlan {
  turns: number;
  targets: number;
  calls: number;
}

export function planComparison(clientTurns: string[], targets: ComparisonTarget[]): ComparisonPlan {
  return {
    turns: clientTurns.length,
    targets: targets.length,
    calls: clientTurns.length * targets.length,
  };
}

export function targetKey(target: ComparisonTarget): string {
  return `${target.provider}/${target.model}`;
}

export interface TargetSummary extends ComparisonTarget {
  turns: number;
  failures: number;
  totalRetries: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  // How many lead fields the model had collected by the end — the outcome that matters
  // more than how pleasant the wording is.
  fieldsFilled: number;
  mechanism: string;
}

function countFilledFields(fields: LeadFields | null): number {
  if (!fields) return 0;
  return Object.values(fields).filter((value) => typeof value === "string" && value.trim().length > 0).length;
}

export function summariseTarget(rows: ComparisonResultRow[]): TargetSummary | null {
  if (rows.length === 0) return null;

  const ordered = [...rows].sort((a, b) => a.turnIndex - b.turnIndex);
  const successful = ordered.filter((row) => !row.error);
  const lastWithFields = [...successful].reverse().find((row) => row.fields);

  return {
    provider: ordered[0].provider,
    model: ordered[0].model,
    turns: ordered.length,
    failures: ordered.length - successful.length,
    totalRetries: ordered.reduce((sum, row) => sum + row.retries, 0),
    avgLatencyMs:
      successful.length === 0
        ? 0
        : Math.round(successful.reduce((sum, row) => sum + row.latencyMs, 0) / successful.length),
    totalInputTokens: ordered.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    totalOutputTokens: ordered.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
    fieldsFilled: countFilledFields(lastWithFields?.fields ?? null),
    mechanism: ordered[0].mechanism,
  };
}

export function summariseRun(rows: ComparisonResultRow[]): TargetSummary[] {
  const groups = new Map<string, ComparisonResultRow[]>();

  for (const row of rows) {
    const key = targetKey(row);
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.values()].map((group) => summariseTarget(group)).filter((item): item is TargetSummary => item !== null);
}
