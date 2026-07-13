import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { connectInstagramAccount } from "@/lib/instagramOAuth";
import { instagramApiClient } from "@/lib/instagramApiClient";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

const PUBLIC_URL = process.env.NEXTAUTH_URL;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", PUBLIC_URL ?? req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("ig_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/panel/connections?error=oauth_state", PUBLIC_URL ?? req.url));
  }

  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  const redirectUri = process.env.IG_REDIRECT_URI;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!appId || !appSecret || !redirectUri || !encryptionKey) {
    return NextResponse.redirect(new URL("/panel/connections?error=not_configured", PUBLIC_URL ?? req.url));
  }

  try {
    const account = await connectInstagramAccount(
      code,
      { appId, appSecret, redirectUri },
      instagramApiClient,
    );

    await prisma.instagramAccount.upsert({
      where: { instagramUserId: account.instagramUserId },
      create: {
        instagramUserId: account.instagramUserId,
        username: account.username,
        accessToken: encrypt(account.accessToken, encryptionKey),
        tokenExpiresAt: account.tokenExpiresAt,
        connectedByUserId: session.user.id,
      },
      update: {
        username: account.username,
        accessToken: encrypt(account.accessToken, encryptionKey),
        tokenExpiresAt: account.tokenExpiresAt,
        connectedByUserId: session.user.id,
      },
    });
  } catch {
    return NextResponse.redirect(new URL("/panel/connections?error=connect_failed", PUBLIC_URL ?? req.url));
  }

  const response = NextResponse.redirect(new URL("/panel/connections", PUBLIC_URL ?? req.url));
  response.cookies.delete("ig_oauth_state");
  return response;
}
