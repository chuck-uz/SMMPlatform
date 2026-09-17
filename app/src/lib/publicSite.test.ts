import { describe, expect, it } from "vitest";
import { parseContactEmail, parseSiteUrl } from "./publicSite";

describe("parseSiteUrl", () => {
  it("returns origin and host of a valid URL", () => {
    expect(parseSiteUrl("https://smm.example.com/")).toEqual({
      origin: "https://smm.example.com",
      host: "smm.example.com",
    });
  });

  it("keeps a non-default port in the host", () => {
    expect(parseSiteUrl(" http://localhost:3001 ")).toEqual({
      origin: "http://localhost:3001",
      host: "localhost:3001",
    });
  });

  it("returns null when unset, blank or malformed", () => {
    expect(parseSiteUrl(undefined)).toBeNull();
    expect(parseSiteUrl("  ")).toBeNull();
    expect(parseSiteUrl("not a url")).toBeNull();
  });
});

describe("parseContactEmail", () => {
  it("returns a trimmed address", () => {
    expect(parseContactEmail(" owner@example.com ")).toBe("owner@example.com");
  });

  it("returns null when unset, blank or not an address", () => {
    expect(parseContactEmail(undefined)).toBeNull();
    expect(parseContactEmail("")).toBeNull();
    expect(parseContactEmail("owner")).toBeNull();
  });
});
