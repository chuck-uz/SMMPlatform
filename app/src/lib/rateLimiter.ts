export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + opts.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;

      return {
        allowed: bucket.count <= opts.limit,
        remaining: Math.max(0, opts.limit - bucket.count),
        resetAt: bucket.resetAt,
      };
    },
  };
}
