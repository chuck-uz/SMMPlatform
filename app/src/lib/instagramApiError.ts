// Graph API failures arrive as an HTTP status plus a JSON body whose `error` object
// carries the real reason. A few of those reasons are permanent for a given object:
// no amount of retrying will ever produce a different answer, so re-requesting them
// on every poll cycle only burns rate-limit quota (Instagram's limit is a function of
// impressions, so wasted calls are not free) and buries genuine errors in log noise.

export interface GraphErrorDetails {
  code: number | null;
  subcode: number | null;
  type: string | null;
  message: string | null;
}

// Permanently insights-ineligible media. Kept deliberately short: mis-classifying a
// transient failure as permanent silently stops metrics for that post forever, which
// is a far worse failure than a few wasted retries. Add a subcode here only once it
// is confirmed to be unrecoverable.
const PERMANENT_INSIGHTS_ERRORS: ReadonlyArray<{ code: number; subcode: number; reason: string }> = [
  {
    // "The media was posted before the most recent time that the user's account was
    // converted to a business account from a personal account."
    code: 100,
    subcode: 2108006,
    reason: "posted_before_business_conversion",
  },
];

export class InstagramApiError extends Error {
  readonly status: number;
  readonly graphError: GraphErrorDetails | null;

  constructor(message: string, params: { status: number; graphError: GraphErrorDetails | null }) {
    super(message);
    this.name = "InstagramApiError";
    this.status = params.status;
    this.graphError = params.graphError;
  }
}

/**
 * Pull the Graph `error` object out of a raw response body. Returns null for bodies
 * that are empty, not JSON (upstream HTML error pages), or shaped unexpectedly —
 * callers must treat "unknown" as retryable rather than permanent.
 */
export function parseGraphError(body: string): GraphErrorDetails | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const error = (parsed as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;

  const raw = error as Record<string, unknown>;
  return {
    code: typeof raw.code === "number" ? raw.code : null,
    subcode: typeof raw.error_subcode === "number" ? raw.error_subcode : null,
    type: typeof raw.type === "string" ? raw.type : null,
    message: typeof raw.message === "string" ? raw.message : null,
  };
}

/**
 * True when a `/{media-id}/insights` failure means Meta will never return insights
 * for that media, so it should be skipped by future metric polls instead of retried.
 *
 * Structural rather than `instanceof` so it stays a pure predicate over plain data
 * and is unaffected by duplicate module instances.
 */
export function isPermanentInsightsError(error: unknown): boolean {
  return permanentInsightsErrorReason(error) !== null;
}

/**
 * The short reason slug for a permanent insights failure, or null when the failure is
 * (or might be) transient. Stored alongside the flag so a post without metrics can be
 * explained later without digging through logs.
 */
export function permanentInsightsErrorReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const graphError = (error as { graphError?: unknown }).graphError;
  if (!graphError || typeof graphError !== "object") return null;

  const { code, subcode } = graphError as { code?: unknown; subcode?: unknown };
  const match = PERMANENT_INSIGHTS_ERRORS.find(
    (candidate) => candidate.code === code && candidate.subcode === subcode,
  );
  return match ? match.reason : null;
}
