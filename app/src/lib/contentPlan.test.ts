import { describe, expect, it } from "vitest";
import {
  buildPlanSlots,
  parseContentPlan,
  buildContentPlanPrompt,
  CONTENT_FORMATS,
} from "./contentPlan";

const START = new Date("2026-08-03T00:00:00Z"); // a Monday

describe("buildPlanSlots", () => {
  it("spreads a week's posts across 7 days", () => {
    const slots = buildPlanSlots({ horizon: "week", startDate: START, postsPerWeek: 3 });
    expect(slots.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-05",
      "2026-08-07",
    ]);
  });

  it("produces postsPerWeek × 4 slots across a 28-day month window", () => {
    const slots = buildPlanSlots({ horizon: "month", startDate: START, postsPerWeek: 3 });
    expect(slots).toHaveLength(12);
    // First slot on the start date, last slot inside the 28-day window.
    expect(slots[0].toISOString().slice(0, 10)).toBe("2026-08-03");
    expect(slots[11].toISOString().slice(0, 10)).toBe("2026-08-28");
  });

  it("never returns zero slots even when cadence is zero", () => {
    const slots = buildPlanSlots({ horizon: "week", startDate: START, postsPerWeek: 0 });
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps slots in ascending date order", () => {
    const slots = buildPlanSlots({ horizon: "month", startDate: START, postsPerWeek: 5 });
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].getTime()).toBeGreaterThanOrEqual(slots[i - 1].getTime());
    }
  });
});

describe("parseContentPlan", () => {
  const validItem = {
    rubric: "Направления",
    idea: "Подборка по Стамбулу",
    caption: "5 причин лететь в Стамбул этой осенью…",
    hashtags: "#стамбул #туры",
    format: "carousel",
  };

  it("parses a well-formed plan", () => {
    const parsed = parseContentPlan({ rationale: "Упор на осенний спрос", items: [validItem] });
    expect(parsed).toEqual({
      rationale: "Упор на осенний спрос",
      items: [
        {
          rubric: "Направления",
          idea: "Подборка по Стамбулу",
          captionDraft: "5 причин лететь в Стамбул этой осенью…",
          hashtags: "#стамбул #туры",
          format: "carousel",
        },
      ],
    });
  });

  it("defaults an unknown format to photo instead of rejecting the item", () => {
    const parsed = parseContentPlan({ items: [{ ...validItem, format: "hologram" }] });
    expect(parsed?.items[0].format).toBe("photo");
  });

  it("defaults a missing rationale to an empty string", () => {
    const parsed = parseContentPlan({ items: [validItem] });
    expect(parsed?.rationale).toBe("");
  });

  it("returns null for a non-object", () => {
    expect(parseContentPlan(null)).toBeNull();
    expect(parseContentPlan("nope")).toBeNull();
  });

  it("returns null when items is missing or empty", () => {
    expect(parseContentPlan({ rationale: "x" })).toBeNull();
    expect(parseContentPlan({ items: [] })).toBeNull();
  });

  it("skips items that are not objects but keeps the valid ones", () => {
    const parsed = parseContentPlan({ items: ["junk", validItem] });
    expect(parsed?.items).toHaveLength(1);
  });

  it("returns null when every item is junk", () => {
    expect(parseContentPlan({ items: ["junk", 42] })).toBeNull();
  });

  it("coerces missing string fields to empty strings", () => {
    const parsed = parseContentPlan({ items: [{ format: "reels" }] });
    expect(parsed?.items[0]).toEqual({
      rubric: "",
      idea: "",
      captionDraft: "",
      hashtags: "",
      format: "reels",
    });
  });

  it("exposes the allowed formats", () => {
    expect(CONTENT_FORMATS).toEqual(["photo", "carousel", "reels"]);
  });
});

describe("buildContentPlanPrompt", () => {
  const strategy = {
    brandVoice: "Тёплый, экспертный",
    audience: "Семьи 30–45 из Ташкента",
    goal: "Заявки на туры",
    seasonal: "Осень, бархатный сезон",
    avoidTopics: "Политика",
    postsPerWeek: 3,
    pillars: [{ name: "Направления", description: "Вдохновение странами" }],
    formats: ["photo", "carousel"],
  };

  it("includes the strategy knobs and the exact slot count", () => {
    const prompt = buildContentPlanPrompt({
      strategy,
      horizon: "week",
      slotCount: 3,
      grounding: "",
    });
    expect(prompt).toContain("Тёплый, экспертный");
    expect(prompt).toContain("Семьи 30–45 из Ташкента");
    expect(prompt).toContain("Направления");
    expect(prompt).toContain("Политика");
    expect(prompt).toContain("ровно 3");
  });

  it("includes grounding when provided and omits an empty grounding section", () => {
    const withGround = buildContentPlanPrompt({ strategy, horizon: "week", slotCount: 3, grounding: "Лучшее время — четверг" });
    expect(withGround).toContain("Лучшее время — четверг");

    const without = buildContentPlanPrompt({ strategy, horizon: "week", slotCount: 3, grounding: "" });
    expect(without).not.toContain("Данные аккаунта");
  });
});
