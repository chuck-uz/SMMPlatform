import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { instagramContentClient } from "./instagramContentClient";
import { normalizeMedia, selectDeletedMediaIds } from "./instagramPoller";

// One place that reconciles a single account's posts with Instagram: upsert what Meta
// returns (new posts, refreshed caption/counts) and hard-delete stored posts Meta has
// stopped returning — the "ghost post" case after a deletion on Instagram. Both the
// 15-minute poller and the manual «Обновить посты» button call this, so their behaviour
// can never drift apart. Deletion is a cascade: a removed post takes its comments and
// metric snapshots with it (a deliberate, irreversible choice).
export async function syncAccountMedia(
  account: { id: string; accessToken: string },
  encryptionKey: string,
): Promise<{ upserted: number; deleted: number }> {
  const accessToken = decrypt(account.accessToken, encryptionKey);
  const rawMedia = await instagramContentClient.listMedia({ accessToken });

  for (const raw of rawMedia) {
    const media = normalizeMedia(raw, account.id);
    await prisma.instagramMedia.upsert({
      where: { instagramMediaId: media.instagramMediaId },
      create: media,
      update: {
        likeCount: media.likeCount,
        commentsCount: media.commentsCount,
        caption: media.caption,
        permalink: media.permalink,
      },
    });
  }

  const returnedMedia = rawMedia.map((raw) => ({
    instagramMediaId: String(raw.id),
    postedAt: new Date(raw.timestamp),
  }));
  const storedMedia = await prisma.instagramMedia.findMany({
    where: { accountId: account.id },
    select: { instagramMediaId: true, postedAt: true },
  });
  const deletedIds = selectDeletedMediaIds({ storedMedia, returnedMedia });
  if (deletedIds.length > 0) {
    await prisma.instagramMedia.deleteMany({ where: { instagramMediaId: { in: deletedIds } } });
  }

  return { upserted: rawMedia.length, deleted: deletedIds.length };
}
