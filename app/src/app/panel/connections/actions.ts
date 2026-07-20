"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { connectProviderApiKey } from "@/lib/llm/credentials";
import { providerVerifier } from "@/lib/llm/verify";
import { clearModelCache, listModels } from "@/lib/llm/catalog";
import { isInteractionType, isSupportedProvider } from "@/lib/llm/router";
import { connectTelegramBot } from "@/lib/telegramBot";
import { telegramBotClient, sendTelegramMessage } from "@/lib/telegramClient";
import { encrypt, decrypt } from "@/lib/encryption";
import { instagramContentClient } from "@/lib/instagramContentClient";
import { diagnoseInstagramRead, pickProbeMedia } from "@/lib/instagramReadDiagnostic";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступно только администратору");
  }
}

export async function disconnectInstagramAccountAction(accountId: string) {
  // Disconnect cascade-deletes all media/comments/metrics/reports for the account —
  // an irreversible destructive action, so restrict it to admins like every other
  // mutation in this file (was previously reachable by any manager).
  await requireAdmin();

  await prisma.instagramAccount.delete({ where: { id: accountId } });

  revalidatePath("/panel/connections");
}

export async function saveProviderKeyAction(provider: string, apiKey: string) {
  await requireAdmin();

  if (!isSupportedProvider(provider)) {
    throw new Error("Неизвестный провайдер");
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  const { encryptedApiKey, verified } = await connectProviderApiKey(apiKey, {
    verifier: providerVerifier(provider),
    encrypt: (plaintext) => encrypt(plaintext, encryptionKey),
  });

  await prisma.llmProviderCredential.upsert({
    where: { provider },
    create: { provider, encryptedApiKey, verified, verifiedAt: new Date() },
    update: { encryptedApiKey, verified, verifiedAt: new Date() },
  });

  // A new key can see a different catalogue than the previous one.
  clearModelCache(provider);
  revalidatePath("/panel/connections");

  return { verified };
}

export async function removeProviderKeyAction(provider: string) {
  await requireAdmin();

  if (!isSupportedProvider(provider)) {
    throw new Error("Неизвестный провайдер");
  }

  await prisma.llmProviderCredential.deleteMany({ where: { provider } });
  clearModelCache(provider);

  revalidatePath("/panel/connections");
}

export async function saveModelRouteAction(params: { interactionType: string; provider: string; model: string }) {
  await requireAdmin();

  if (!isInteractionType(params.interactionType)) {
    throw new Error("Неизвестная точка взаимодействия");
  }
  if (!isSupportedProvider(params.provider)) {
    throw new Error("Неизвестный провайдер");
  }
  if (!params.model.trim()) {
    throw new Error("Укажите модель");
  }

  const credential = await prisma.llmProviderCredential.findUnique({ where: { provider: params.provider } });
  if (!credential) {
    throw new Error("Сначала добавьте API-ключ этого провайдера");
  }

  await prisma.llmRouteConfig.upsert({
    where: { interactionType: params.interactionType },
    create: { interactionType: params.interactionType, provider: params.provider, model: params.model.trim() },
    update: { provider: params.provider, model: params.model.trim() },
  });

  revalidatePath("/panel/connections");
}

// Feeds the model picker. Returns an empty list with a reason rather than throwing, so a
// provider outage degrades to manual entry instead of breaking the page.
export async function loadProviderModelsAction(
  provider: string,
  forceRefresh = false,
): Promise<{ models: Array<{ id: string; label: string; supportsStructuredOutputs: boolean }>; error?: string }> {
  await requireAdmin();

  if (!isSupportedProvider(provider)) {
    return { models: [], error: "Неизвестный провайдер" };
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  const credential = await prisma.llmProviderCredential.findUnique({ where: { provider } });
  if (!encryptionKey || !credential) {
    return { models: [], error: "Сначала добавьте API-ключ этого провайдера" };
  }

  try {
    const models = await listModels(provider, decrypt(credential.encryptedApiKey, encryptionKey), { forceRefresh });
    return { models };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[connections] failed to list models for ${provider}`, error);
    return { models: [], error: message };
  }
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

export type InstagramReadDiagnosticResult =
  | ({ ok: true; username: string } & Awaited<ReturnType<typeof diagnoseInstagramRead>>)
  | { ok: false; stage: "network" | "api"; error: string };

// Live, on-demand probe run from the server that hosts the app — so it tests two
// things at once that a laptop can't: whether Standard Access actually returns
// comment data (see diagnoseInstagramRead), and whether the request even reaches
// graph.instagram.com from this host (an egress block from a RU-hosted server
// surfaces here as a network-stage failure, not an empty result).
export async function runInstagramReadDiagnosticAction(
  accountId: string,
): Promise<InstagramReadDiagnosticResult> {
  await requireAdmin();

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  const account = await prisma.instagramAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("Аккаунт не найден");
  }

  const accessToken = decrypt(account.accessToken, encryptionKey);

  try {
    const media = await instagramContentClient.listMedia({ accessToken });
    // Probe the newest post that actually has comments, so a comment-less latest
    // post doesn't make the check inconclusive.
    const probeMedia = pickProbeMedia(media);
    const probeComments = probeMedia
      ? await instagramContentClient.listComments({ accessToken, mediaId: probeMedia.id })
      : null;
    const diagnosis = diagnoseInstagramRead({ mediaCount: media.length, probeMedia, probeComments });
    return { ok: true, username: account.username, ...diagnosis };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The content client throws "Instagram content API request failed: <status> …"
    // when Instagram answered with a non-2xx (token/permission problem). Anything
    // else — a thrown fetch/AbortError before a response — means the request never
    // completed: DNS/TLS/timeout, i.e. the egress path to Meta is the suspect.
    const stage: "network" | "api" = message.includes("request failed:") ? "api" : "network";
    console.error(`[ig-read-diagnostic] account ${accountId} failed at ${stage} stage`, error);
    return { ok: false, stage, error: message };
  }
}
