const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_DAYS = 7;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { refreshAccountToken, daysUntilExpiry } = await import("@/lib/instagramOAuth");
  const { instagramApiClient } = await import("@/lib/instagramApiClient");
  const { encrypt, decrypt } = await import("@/lib/encryption");

  async function refreshExpiringTokens() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const now = new Date();
    const accounts = await prisma.instagramAccount.findMany();

    for (const account of accounts) {
      if (daysUntilExpiry(account.tokenExpiresAt, now) > REFRESH_THRESHOLD_DAYS) continue;

      try {
        const accessToken = decrypt(account.accessToken, encryptionKey);
        const refreshed = await refreshAccountToken(accessToken, instagramApiClient, now);
        await prisma.instagramAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(refreshed.accessToken, encryptionKey),
            tokenExpiresAt: refreshed.tokenExpiresAt,
          },
        });
      } catch (error) {
        console.error(`[instagram-refresh] failed to refresh account ${account.id}`, error);
      }
    }
  }

  setInterval(refreshExpiringTokens, CHECK_INTERVAL_MS);
  void refreshExpiringTokens();
}
