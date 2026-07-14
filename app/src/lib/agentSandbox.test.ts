import { describe, expect, it } from "vitest";
import {
  buildExampleDialogueTurns,
  canSaveAsExample,
  DEFAULT_SANDBOX_MODEL,
  isValidSandboxModel,
  SANDBOX_MODEL_OPTIONS,
  type SandboxTurn,
} from "./agentSandbox";

describe("canSaveAsExample", () => {
  it("returns false for an empty session", () => {
    expect(canSaveAsExample([])).toBe(false);
  });

  it("returns false when there are no agent turns yet", () => {
    const turns: SandboxTurn[] = [{ role: "client", content: "Привет" }];
    expect(canSaveAsExample(turns)).toBe(false);
  });

  it("returns true when every agent turn is unrated", () => {
    const turns: SandboxTurn[] = [
      { role: "client", content: "Привет" },
      { role: "agent", content: "Здравствуйте!", rating: null },
    ];
    expect(canSaveAsExample(turns)).toBe(true);
  });

  it("returns true when every agent turn is rated up", () => {
    const turns: SandboxTurn[] = [
      { role: "client", content: "Привет" },
      { role: "agent", content: "Здравствуйте!", rating: "up" },
    ];
    expect(canSaveAsExample(turns)).toBe(true);
  });

  it("returns false when any agent turn is rated down", () => {
    const turns: SandboxTurn[] = [
      { role: "client", content: "Привет" },
      { role: "agent", content: "Здравствуйте!", rating: "up" },
      { role: "client", content: "А туры в Египет?" },
      { role: "agent", content: "Не знаю, придумайте сами.", rating: "down" },
    ];
    expect(canSaveAsExample(turns)).toBe(false);
  });
});

describe("buildExampleDialogueTurns", () => {
  it("strips the rating field, keeping role and content", () => {
    const turns: SandboxTurn[] = [
      { role: "client", content: "Привет", rating: null },
      { role: "agent", content: "Здравствуйте!", rating: "up" },
    ];
    expect(buildExampleDialogueTurns(turns)).toEqual([
      { role: "client", content: "Привет" },
      { role: "agent", content: "Здравствуйте!" },
    ]);
  });

  it("returns an empty array for an empty session", () => {
    expect(buildExampleDialogueTurns([])).toEqual([]);
  });
});

describe("SANDBOX_MODEL_OPTIONS", () => {
  it("excludes Fable/Mythos and includes the default model", () => {
    const ids = SANDBOX_MODEL_OPTIONS.map((option) => option.id);

    expect(ids).toContain(DEFAULT_SANDBOX_MODEL);
    expect(ids.some((id) => id.includes("fable"))).toBe(false);
    expect(ids.some((id) => id.includes("mythos"))).toBe(false);
  });
});

describe("isValidSandboxModel", () => {
  it("accepts every listed sandbox model", () => {
    for (const option of SANDBOX_MODEL_OPTIONS) {
      expect(isValidSandboxModel(option.id)).toBe(true);
    }
  });

  it("rejects a model id that is not in the list", () => {
    expect(isValidSandboxModel("claude-fable-5")).toBe(false);
    expect(isValidSandboxModel("not-a-model")).toBe(false);
  });
});
