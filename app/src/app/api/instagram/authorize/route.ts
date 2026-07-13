import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { buildAuthorizeUrl } from "@/lib/instagramOAuth";

const PUBLIC_URL = process.env.NEXTAUTH_URL;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", PUBLIC_URL ?? req.url));
  }

  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  const redirectUri = process.env.IG_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/panel/connections?error=not_configured", PUBLIC_URL ?? req.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl({ appId, appSecret, redirectUri, state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });
  return response;
}
