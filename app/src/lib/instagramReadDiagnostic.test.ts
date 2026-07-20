import { describe, it, expect } from "vitest";
import { diagnoseInstagramRead } from "./instagramReadDiagnostic";

describe("diagnoseInstagramRead", () => {
  it("returns no_media when the account has no posts", () => {
    const result = diagnoseInstagramRead({ media: [], newestComments: null });
    expect(result.verdict).toBe("no_media");
    expect(result.mediaCount).toBe(0);
  });

  it("is inconclusive when the newest post has no comments", () => {
    const result = diagnoseInstagramRead({
      media: [{ id: "1", comments_count: 0 }],
      newestComments: [],
    });
    expect(result.verdict).toBe("inconclusive_no_comments");
  });

  it("flags standard_access_hidden when the post reports comments but the API returns none", () => {
    const result = diagnoseInstagramRead({
      media: [{ id: "1", comments_count: 5 }],
      newestComments: [],
    });
    expect(result.verdict).toBe("standard_access_hidden");
    expect(result.reportedCommentCount).toBe(5);
    expect(result.returnedCommentCount).toBe(0);
  });

  it("returns ok when the API actually returns comments", () => {
    const result = diagnoseInstagramRead({
      media: [{ id: "1", comments_count: 5 }],
      newestComments: [{ id: "c1" }, { id: "c2" }],
    });
    expect(result.verdict).toBe("ok");
    expect(result.returnedCommentCount).toBe(2);
  });

  it("treats a missing comments_count as zero (inconclusive, not a false positive)", () => {
    const result = diagnoseInstagramRead({
      media: [{ id: "1" }],
      newestComments: [],
    });
    expect(result.verdict).toBe("inconclusive_no_comments");
  });
});
