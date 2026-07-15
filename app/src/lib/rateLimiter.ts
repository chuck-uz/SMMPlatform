export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = 0;

  // Evict expired buckets so the map cannot grow without bound. Without this a
  // stream of distinct keys (e.g. spoofed/rotating IPs, or benign internet
  // scanning over months of uptime) leaks memory in the long-running container.
  function sweep(now: number) {
    if (now - lastSweep < opts.windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(key);
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      sweep(now);

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

    // Number of tracked buckets — exposed for tests/observability.
    size(): number {
      return buckets.size;
    },
  };
}
