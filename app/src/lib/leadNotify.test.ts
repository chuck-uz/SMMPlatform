import { describe, expect, it } from "vitest";
import { buildLeadNotificationText } from "./leadNotify";

describe("buildLeadNotificationText", () => {
  it("formats all fields when present", () => {
    const text = buildLeadNotificationText({
      source: "direct",
      destination: "Турция",
      people: "2 взрослых",
      dates: "конец августа",
      budget: "$2000",
      contact: "+998901234567",
      wishes: "поближе к морю",
    });

    expect(text).toContain("источник: директ");
    expect(text).toContain("Направление: Турция");
    expect(text).toContain("Люди: 2 взрослых");
    expect(text).toContain("Даты: конец августа");
    expect(text).toContain("Бюджет: $2000");
    expect(text).toContain("Контакт: +998901234567");
    expect(text).toContain("Пожелания: поближе к морю");
  });

  it("shows a dash placeholder for missing optional fields", () => {
    const text = buildLeadNotificationText({
      source: "sandbox",
      destination: "Турция",
      people: null,
      dates: null,
      budget: null,
      contact: null,
      wishes: null,
    });

    expect(text).toContain("источник: песочница");
    expect(text).toContain("Люди: —");
    expect(text).toContain("Бюджет: —");
  });

  it("falls back to the raw source value for an unknown source", () => {
    const text = buildLeadNotificationText({
      source: "unknown-channel",
      destination: null,
      people: null,
      dates: null,
      budget: null,
      contact: null,
      wishes: null,
    });

    expect(text).toContain("источник: unknown-channel");
  });
});
