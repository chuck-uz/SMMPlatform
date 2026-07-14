"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { connectClaudeApiKey } from "@/lib/claudeApiKey";
import { claudeApiClient } from "@/lib/claudeApiClient";
import { connectTelegramBot } from "@/lib/telegramBot";
import { telegramBotClient, sendTelegramMessage } from "@/lib/telegramClient";
import { encrypt, decrypt } from "@/lib/encryption";

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

export async function saveTelegramBotTokenAction(botToken: string) {
  await requireAdmin();

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  const { encryptedBotToken, verified } = await connectTelegramBot(botToken, {
    client: telegramBotClient,
    encrypt: (plaintext) => encrypt(plaintext, encryptionKey),
  });

  await prisma.telegramBotConfig.upsert({
    where: { singleton: "telegram" },
    create: { singleton: "telegram", encryptedBotToken, verified, verifiedAt: new Date() },
    update: { encryptedBotToken, verified, verifiedAt: new Date() },
  });

  revalidatePath("/panel/connections");

  return { verified };
}

export async function removeTelegramBotTokenAction() {
  await requireAdmin();

  await prisma.telegramBotConfig.deleteMany({ where: { singleton: "telegram" } });

  revalidatePath("/panel/connections");
}

export async function addTelegramRecipientAction(params: { chatId: string; label: string }) {
  await requireAdmin();

  if (!params.chatId.trim()) {
    throw new Error("chat_id не может быть пустым");
  }

  await prisma.telegramNotificationRecipient.create({
    data: { chatId: params.chatId.trim(), label: params.label.trim() || null },
  });

  revalidatePath("/panel/connections");
}

export async function removeTelegramRecipientAction(id: string) {
  await requireAdmin();

  await prisma.telegramNotificationRecipient.delete({ where: { id } });

  revalidatePath("/panel/connections");
}

export async function sendTestTelegramMessageAction() {
  await requireAdmin();

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  const botConfig = await prisma.telegramBotConfig.findUnique({ where: { singleton: "telegram" } });
  if (!botConfig?.verified) {
    throw new Error("Сначала сохраните и проверьте токен бота");
  }

  const recipients = await prisma.telegramNotificationRecipient.findMany();
  if (recipients.length === 0) {
    throw new Error("В white list пока нет получателей");
  }

  const botToken = decrypt(botConfig.encryptedBotToken, encryptionKey);
  const text = "🔔 Тестовое уведомление от SMM Platform. Если вы это видите — рассылка настроена верно.";

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const recipient of recipients) {
    try {
      await sendTelegramMessage(botToken, recipient.chatId, text);
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[telegram-test] failed to send to chatId ${recipient.chatId}`, error);
      errors.push(`${recipient.chatId}: ${message}`);
    }
  }

  return { sent, failed, errors };
}
