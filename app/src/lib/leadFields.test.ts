import { describe, expect, it } from "vitest";

describe("mergeLeadFields", () => {
  // The bug this exists for: the model returns a full snapshot every turn, and one turn
  // that omitted "Стамбул" wiped an already-collected destination from the lead.
  it("keeps a known value when the new snapshot forgot it", () => {
    const previous = { ...EMPTY, destination: "Стамбул", people: "2" };
    const incoming = { ...EMPTY, people: "2", dates: "январь" };

    expect(mergeLeadFields(previous, incoming)).toEqual({
      ...EMPTY,
      destination: "Стамбул",
      people: "2",
      dates: "январь",
    });
  });

  it("lets the client correct a value", () => {
    const previous = { ...EMPTY, destination: "Дубай" };
    const incoming = { ...EMPTY, destination: "Стамбул" };

    expect(mergeLeadFields(previous, incoming).destination).toBe("Стамбул");
  });

  it("treats a blank string as no answer, not as an erasure", () => {
    const previous = { ...EMPTY, contact: "+998935344354" };
    const incoming = { ...EMPTY, contact: "   " };

    expect(mergeLeadFields(previous, incoming).contact).toBe("+998935344354");
  });

  it("accumulates across several turns", () => {
    const turn1 = mergeLeadFields(EMPTY, { ...EMPTY, destination: "Стамбул" });
    const turn2 = mergeLeadFields(turn1, { ...EMPTY, people: "2" });
    const turn3 = mergeLeadFields(turn2, { ...EMPTY, contact: "@user" });

    expect(turn3).toEqual({ ...EMPTY, destination: "Стамбул", people: "2", contact: "@user" });
  });

  it("starts from the incoming snapshot when nothing is known yet", () => {
    expect(mergeLeadFields(null, { ...EMPTY, destination: "Стамбул" })).toEqual({
      ...EMPTY,
      destination: "Стамбул",
    });
  });
});
import { isLeadComplete, mergeLeadFields, parseAgentReplyContent, type LeadFields } from "./leadFields";

const EMPTY: LeadFields = {
  destination: null,
  people: null,
  dates: null,
  budget: null,
  contact: null,
  wishes: null,
};

describe("isLeadComplete", () => {
  it("returns false when all fields are empty", () => {
    expect(isLeadComplete(EMPTY)).toBe(false);
  });

  it("returns true when all required fields are filled and optional fields are empty", () => {
    expect(
      isLeadComplete({
        ...EMPTY,
        destination: "Турция",
        people: "2 взрослых",
        dates: "конец августа",
        contact: "+998901234567",
      }),
    ).toBe(true);
  });

  it("returns false when one required field is missing", () => {
    expect(
      isLeadComplete({
        ...EMPTY,
        destination: "Турция",
        people: "2 взрослых",
        dates: "конец августа",
        contact: null,
      }),
    ).toBe(false);
  });

  it("treats a whitespace-only required field as missing", () => {
    expect(
      isLeadComplete({
        ...EMPTY,
        destination: "Турция",
        people: "2 взрослых",
        dates: "конец августа",
        contact: "   ",
      }),
    ).toBe(false);
  });

  it("returns true when every field including optional ones is filled", () => {
    expect(
      isLeadComplete({
        destination: "Турция",
        people: "2 взрослых, 1 ребёнок",
        dates: "конец августа, неделя",
        budget: "около $2000",
        contact: "+998901234567",
        wishes: "поближе к морю",
      }),
    ).toBe(true);
  });
});

describe("parseAgentReplyContent", () => {
  const validFields = {
    destination: "Турция",
    people: null,
    dates: null,
    budget: null,
    contact: null,
    wishes: null,
  };

  it("parses a valid reply+fields object", () => {
    expect(parseAgentReplyContent({ reply: "Здравствуйте!", fields: validFields })).toEqual({
      reply: "Здравствуйте!",
      fields: validFields,
    });
  });

  it("returns null when reply is missing", () => {
    expect(parseAgentReplyContent({ fields: validFields })).toBeNull();
  });

  it("returns null when fields is missing", () => {
    expect(parseAgentReplyContent({ reply: "Здравствуйте!" })).toBeNull();
  });

  it("returns null when a field has a non-string, non-null value", () => {
    expect(
      parseAgentReplyContent({ reply: "Здравствуйте!", fields: { ...validFields, people: 2 } }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseAgentReplyContent(null)).toBeNull();
    expect(parseAgentReplyContent("not an object")).toBeNull();
  });
});
