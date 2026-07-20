import { describe, expect, it } from "vitest";
import {
  extractClientTurns,
  parseManualTurns,
  planComparison,
  summariseRun,
  summariseTarget,
  targetKey,
  type ComparisonResultRow,
} from "./modelComparison";
import type { LeadFields } from "./leadFields";

const EMPTY: LeadFields = {
  destination: null,
  people: null,
  dates: null,
  budget: null,
  contact: null,
  wishes: null,
};

function row(overrides: Partial<ComparisonResultRow>): ComparisonResultRow {
  return {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    turnIndex: 0,
    reply: "ответ",
    fields: EMPTY,
    mechanism: "native_schema",
    retries: 0,
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 20,
    error: null,
    ...overrides,
  };
}

describe("extractClientTurns", () => {
  it("keeps only what the client said, in order", () => {
    const turns = [
      { role: "client", content: "Хочу в Дубай" },
      { role: "agent", content: "Отлично! На какие даты?" },
      { role: "client", content: "В мае, вдвоём" },
    ];
    expect(extractClientTurns(turns)).toEqual(["Хочу в Дубай", "В мае, вдвоём"]);
  });

  it("drops blank client lines", () => {
    expect(extractClientTurns([{ role: "client", content: "   " }])).toEqual([]);
  });

  it("returns nothing for an agent-only dialogue", () => {
    expect(extractClientTurns([{ role: "agent", content: "Здравствуйте" }])).toEqual([]);
  });
});

describe("parseManualTurns", () => {
  it("treats each non-empty line as one client message", () => {
    expect(parseManualTurns("Хочу в Дубай\n\n  В мае  \n")).toEqual(["Хочу в Дубай", "В мае"]);
  });

  it("returns nothing for blank input", () => {
    expect(parseManualTurns("   \n  ")).toEqual([]);
  });
});

describe("planComparison", () => {
  it("multiplies turns by models to show the real number of paid calls", () => {
    const plan = planComparison(["a", "b", "c"], [
      { provider: "anthropic", model: "haiku" },
      { provider: "deepseek", model: "deepseek-chat" },
    ]);
    expect(plan).toEqual({ turns: 3, targets: 2, calls: 6 });
  });

  it("plans nothing when there is no scenario", () => {
    expect(planComparison([], [{ provider: "anthropic", model: "haiku" }]).calls).toBe(0);
  });
});

describe("targetKey", () => {
  it("identifies a model by provider and id together", () => {
    expect(targetKey({ provider: "openrouter", model: "deepseek/deepseek-chat" })).toBe(
      "openrouter/deepseek/deepseek-chat",
    );
  });
});

describe("summariseTarget", () => {
  it("averages latency over successful turns only", () => {
    const summary = summariseTarget([
      row({ turnIndex: 0, latencyMs: 100 }),
      row({ turnIndex: 1, latencyMs: 300 }),
      row({ turnIndex: 2, latencyMs: 9999, error: "boom", fields: null }),
    ]);
    expect(summary?.avgLatencyMs).toBe(200);
    expect(summary?.failures).toBe(1);
    expect(summary?.turns).toBe(3);
  });

  it("sums retries and tokens across the whole run", () => {
    const summary = summariseTarget([
      row({ turnIndex: 0, retries: 1, inputTokens: 10, outputTokens: 20 }),
      row({ turnIndex: 1, retries: 1, inputTokens: 5, outputTokens: 7 }),
    ]);
    expect(summary?.totalRetries).toBe(2);
    expect(summary?.totalInputTokens).toBe(15);
    expect(summary?.totalOutputTokens).toBe(27);
  });

  // What actually matters: did the model end up holding a usable lead?
  it("counts the fields collected by the last successful turn", () => {
    const summary = summariseTarget([
      row({ turnIndex: 0, fields: { ...EMPTY, destination: "Дубай" } }),
      row({ turnIndex: 1, fields: { ...EMPTY, destination: "Дубай", people: "2", contact: "@user" } }),
    ]);
    expect(summary?.fieldsFilled).toBe(3);
  });

  it("ignores blank strings when counting collected fields", () => {
    const summary = summariseTarget([row({ fields: { ...EMPTY, destination: "  " } })]);
    expect(summary?.fieldsFilled).toBe(0);
  });

  it("reads turns in index order regardless of arrival order", () => {
    const summary = summariseTarget([
      row({ turnIndex: 1, fields: { ...EMPTY, destination: "Дубай", people: "2" } }),
      row({ turnIndex: 0, fields: { ...EMPTY, destination: "Дубай" } }),
    ]);
    expect(summary?.fieldsFilled).toBe(2);
  });

  it("returns nothing for an empty set", () => {
    expect(summariseTarget([])).toBeNull();
  });
});

describe("summariseRun", () => {
  it("produces one summary per model", () => {
    const summaries = summariseRun([
      row({ provider: "anthropic", model: "haiku", turnIndex: 0 }),
      row({ provider: "anthropic", model: "haiku", turnIndex: 1 }),
      row({ provider: "deepseek", model: "deepseek-chat", turnIndex: 0, latencyMs: 500 }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries.find((item) => item.model === "haiku")?.turns).toBe(2);
    expect(summaries.find((item) => item.model === "deepseek-chat")?.avgLatencyMs).toBe(500);
  });

  it("returns nothing when there are no results", () => {
    expect(summariseRun([])).toEqual([]);
  });
});
