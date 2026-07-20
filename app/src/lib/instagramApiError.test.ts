import { describe, expect, it } from "vitest";
import {
  InstagramApiError,
  isPermanentInsightsError,
  parseGraphError,
  permanentInsightsErrorReason,
} from "./instagramApiError";

const BUSINESS_CONVERSION_BODY = JSON.stringify({
  error: {
    message:
      "De media is geplaatst vóór de meest recente tijd waarop het account van de gebruiker is geconverteerd van persoonlijk account naar bedrijfsaccount.",
    type: "IGApiException",
    code: 100,
    error_subcode: 2108006,
  },
});

function apiError(body: string, status = 400) {
  return new InstagramApiError(`Instagram content API request failed: ${status} /123/insights ${body}`, {
    status,
    graphError: parseGraphError(body),
  });
}

describe("parseGraphError", () => {
  it("extracts code, subcode, type and message from a Graph error body", () => {
    expect(parseGraphError(BUSINESS_CONVERSION_BODY)).toEqual({
      code: 100,
      subcode: 2108006,
      type: "IGApiException",
      message:
        "De media is geplaatst vóór de meest recente tijd waarop het account van de gebruiker is geconverteerd van persoonlijk account naar bedrijfsaccount.",
    });
  });

  it("leaves absent fields null rather than guessing", () => {
    expect(parseGraphError(JSON.stringify({ error: { message: "boom" } }))).toEqual({
      code: null,
      subcode: null,
      type: null,
      message: "boom",
    });
  });

  it("returns null for bodies that are not a Graph error", () => {
    expect(parseGraphError("")).toBeNull();
    expect(parseGraphError("<html>502 Bad Gateway</html>")).toBeNull();
    expect(parseGraphError(JSON.stringify({ data: [] }))).toBeNull();
    expect(parseGraphError(JSON.stringify({ error: "rate limited" }))).toBeNull();
  });
});

describe("isPermanentInsightsError", () => {
  it("is permanent for media posted before the business-account conversion", () => {
    const error = apiError(BUSINESS_CONVERSION_BODY);

    expect(isPermanentInsightsError(error)).toBe(true);
    expect(permanentInsightsErrorReason(error)).toBe("posted_before_business_conversion");
  });

  it("is not permanent for a rate-limit error", () => {
    const error = apiError(
      JSON.stringify({ error: { message: "Application request limit reached", type: "OAuthException", code: 4 } }),
      429,
    );

    expect(isPermanentInsightsError(error)).toBe(false);
    expect(permanentInsightsErrorReason(error)).toBeNull();
  });

  it("is not permanent for an expired token", () => {
    const error = apiError(
      JSON.stringify({
        error: { message: "Session has expired", type: "OAuthException", code: 190, error_subcode: 463 },
      }),
      401,
    );

    expect(isPermanentInsightsError(error)).toBe(false);
  });

  it("is not permanent for another code 100 subcode — only the listed pair counts", () => {
    const error = apiError(
      JSON.stringify({ error: { message: "Unsupported get request", type: "IGApiException", code: 100, error_subcode: 33 } }),
    );

    expect(isPermanentInsightsError(error)).toBe(false);
  });

  it("is not permanent when the subcode appears under a different code", () => {
    const error = apiError(
      JSON.stringify({ error: { message: "whatever", type: "IGApiException", code: 10, error_subcode: 2108006 } }),
    );

    expect(isPermanentInsightsError(error)).toBe(false);
  });

  it("treats unparseable and non-API failures as retryable", () => {
    expect(isPermanentInsightsError(apiError("<html>502 Bad Gateway</html>", 502))).toBe(false);
    expect(isPermanentInsightsError(new Error("fetch failed"))).toBe(false);
    expect(isPermanentInsightsError(new DOMException("timed out", "TimeoutError"))).toBe(false);
    expect(isPermanentInsightsError(null)).toBe(false);
    expect(isPermanentInsightsError(undefined)).toBe(false);
    expect(isPermanentInsightsError("code 100 subcode 2108006")).toBe(false);
  });

  it("keeps the thrown message and status intact for logging", () => {
    const error = apiError(BUSINESS_CONVERSION_BODY);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.message).toContain("Instagram content API request failed: 400 /123/insights");
  });
});
