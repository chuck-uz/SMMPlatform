import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createRateLimiter } from "@/lib/rateLimiter";

const globalLimiter = createRateLimiter({ limit: 100, windowMs: 60_000 });
const loginLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function getClientIp(req: NextRequest): string {
  // Behind Cloudflare, CF-Connecting-IP is the real client IP set by the proxy
  // and is not client-spoofable. Fall back to X-Real-IP, then to the LAST
  // (proxy-appended) X-Forwarded-For entry — never the first, which is
  // client-controlled and would let an attacker rotate rate-limit buckets to
  // bypass the login limiter and grow the bucket map without bound.
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",");
    return parts[parts.length - 1].trim();
  }
  return "unknown";
}

function tooManyRequests(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const limiter = pathname.startsWith("/api/auth/callback/credentials") ? loginLimiter : globalLimiter;
    const result = limiter.check(ip);
    if (!result.allowed) return tooManyRequests(result.resetAt);
    return NextResponse.next();
  }

  return (auth as unknown as (req: NextRequest) => Promise<Response>)(req);
}

export const config = {
  matcher: ["/panel/:path*", "/api/:path*"],
};
