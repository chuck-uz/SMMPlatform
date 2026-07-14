import { describe, expect, it } from "vitest";
import { isLeadComplete, parseAgentReplyContent, type LeadFields } from "./leadFields";

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
