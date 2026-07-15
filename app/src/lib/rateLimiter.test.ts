import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimiter";

describe("createRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.check("1.2.3.4", 0).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 0).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 0).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit within the window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    limiter.check("1.2.3.4", 0);
    limiter.check("1.2.3.4", 0);
    limiter.check("1.2.3.4", 0);

    expect(limiter.check("1.2.3.4", 0).allowed).toBe(false);
  });

  it("resets the count after the window has elapsed", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

    limiter.check("1.2.3.4", 0);
    limiter.check("1.2.3.4", 0);
    expect(limiter.check("1.2.3.4", 0).allowed).toBe(false);

    expect(limiter.check("1.2.3.4", 60_001).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("1.2.3.4", 0).allowed).toBe(true);
    expect(limiter.check("5.6.7.8", 0).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", 0).allowed).toBe(false);
  });

  it("reports remaining requests and reset time", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

    const first = limiter.check("1.2.3.4", 1_000);
    expect(first.remaining).toBe(1);
    expect(first.resetAt).toBe(61_000);

    const second = limiter.check("1.2.3.4", 1_000);
    expect(second.remaining).toBe(0);
  });

  it("evicts expired buckets so the map does not grow without bound", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    // 100 distinct keys within the first window.
    for (let i = 0; i < 100; i += 1) {
      limiter.check(`ip-${i}`, 0);
    }
    expect(limiter.size()).toBe(100);

    // After the window elapses, a new check sweeps the expired buckets.
    limiter.check("fresh", 60_001);
    expect(limiter.size()).toBe(1);
  });
});
