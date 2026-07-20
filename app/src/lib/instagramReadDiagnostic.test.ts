import { describe, it, expect } from "vitest";
import { diagnoseInstagramRead, pickProbeMedia } from "./instagramReadDiagnostic";

describe("pickProbeMedia", () => {
  it("returns null when no post has comments", () => {
    expect(pickProbeMedia([{ comments_count: 0 }, { comments_count: 0 }])).toBeNull();
  });

  it("picks the newest post that has comments (media is newest-first)", () => {
    const media = [
      { id: "newest", comments_count: 0 },
      { id: "hasComments", comments_count: 3 },
      { id: "older", comments_count: 9 },
    ];
    expect(pickProbeMedia(media)?.id).toBe("hasComments");
  });

  it("treats a missing comments_count as zero", () => {
    expect(pickProbeMedia([{ id: "a" }, { id: "b", comments_count: 2 }])?.id).toBe("b");
  });
});

describe("diagnoseInstagramRead", () => {
  it("returns no_media when the account has no posts", () => {
    const result = diagnoseInstagramRead({ mediaCount: 0, probeMedia: null, probeComments: null });
    expect(result.verdict).toBe("no_media");
  });

  it("is inconclusive when no post has comments to probe", () => {
    const result = diagnoseInstagramRead({ mediaCount: 4, probeMedia: null, probeComments: null });
    expect(result.verdict).toBe("inconclusive_no_comments");
  });

  it("flags standard_access_hidden when the probed post reports comments but the API returns none", () => {
    const result = diagnoseInstagramRead({
      mediaCount: 4,
      probeMedia: { id: "1", comments_count: 5 },
      probeComments: [],
    });
    expect(result.verdict).toBe("standard_access_hidden");
    expect(result.reportedCommentCount).toBe(5);
    expect(result.returnedCommentCount).toBe(0);
  });

  it("returns ok when the API actually returns comments", () => {
    const result = diagnoseInstagramRead({
      mediaCount: 4,
      probeMedia: { id: "1", comments_count: 5 },
      probeComments: [{ id: "c1" }, { id: "c2" }],
    });
    expect(result.verdict).toBe("ok");
    expect(result.returnedCommentCount).toBe(2);
  });
});
