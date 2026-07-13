"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { connectClaudeApiKey } from "@/lib/claudeApiKey";
import { claudeApiClient } from "@/lib/claudeApiClient";
import { encrypt } from "@/lib/encryption";

export async function disconnectInstagramAccountAction(accountId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  await prisma.instagramAccount.delete({ where: { id: accountId } });

  revalidatePath("/panel/connections");
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступно только администратору");
  }
}

export async function saveClaudeApiKeyAction(apiKey: string) {
  await requireAdmin();

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  const { encryptedApiKey, verified } = await connectClaudeApiKey(apiKey, {
    client: claudeApiClient,
    encrypt: (plaintext) => encrypt(plaintext, encryptionKey),
  });

  await prisma.claudeApiKeyConfig.upsert({
    where: { singleton: "claude" },
    create: { singleton: "claude", encryptedApiKey, verified, verifiedAt: new Date() },
    update: { encryptedApiKey, verified, verifiedAt: new Date() },
  });

  revalidatePath("/panel/connections");

  return { verified };
}

export async function removeClaudeApiKeyAction() {
  await requireAdmin();

  await prisma.claudeApiKeyConfig.deleteMany({ where: { singleton: "claude" } });

  revalidatePath("/panel/connections");
}
