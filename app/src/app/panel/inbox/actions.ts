"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { buildCommentReplySystemPrompt, buildCommentUserMessage } from "@/lib/commentReply";
import { generateCommentReply } from "@/lib/commentReplyClient";
import { instagramContentClient } from "@/lib/instagramContentClient";
import { createRateLimiter } from "@/lib/rateLimiter";

// Throttle the paid regenerate action per user so nobody can spam it into
// unbounded Claude spend.
const regenerateLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }
  return session;
}

async function requireClaudeApiKey(encryptionKey: string) {
  const claudeConfig = await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } });
  if (!claudeConfig?.verified) {
    throw new Error("Ключ Claude не настроен или не проверен — подключите его на странице «Подключения»");
  }
  return decrypt(claudeConfig.encryptedApiKey, encryptionKey);
}

export async function approveCommentReplyAction(params: { commentId: string; message: string }) {
  await requireSession();

  if (!params.message.trim()) {
    throw new Error("Текст ответа не может быть пустым");
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }

  // Atomically claim the draft before posting so a double-click, a second open
  // tab, or two managers approving the same comment cannot post two public
  // replies. Only a draft_ready/failed comment can be claimed; the transition to
  // "sending" is the lock.
  const claim = await prisma.instagramComment.updateMany({
    where: { id: params.commentId, replyStatus: { in: ["draft_ready", "failed"] } },
    data: { replyStatus: "sending" },
  });
  if (claim.count === 0) {
    throw new Error("Этот комментарий уже отправлен или обрабатывается");
  }

  try {
    const comment = await prisma.instagramComment.findUniqueOrThrow({
      where: { id: params.commentId },
      include: { media: { include: { account: true } } },
    });

    const accessToken = decrypt(comment.media.account.accessToken, encryptionKey);
    const posted = await instagramContentClient.postCommentReply({
      accessToken,
      commentId: comment.instagramCommentId,
      message: params.message,
    });

    await prisma.instagramComment.update({
      where: { id: comment.id },
      data: {
        draftReply: params.message,
        replyStatus: "sent",
        repliedAt: new Date(),
        sentReplyId: typeof posted?.id === "string" ? posted.id : null,
      },
    });
  } catch (error) {
    // Release the lock back to "failed" so the operator can retry.
    await prisma.instagramComment.update({
      where: { id: params.commentId },
      data: { replyStatus: "failed" },
    });
    throw error;
  }

  revalidatePath("/panel/inbox");
}

export async function regenerateCommentReplyAction(commentId: string) {
  const session = await requireSession();

  if (!regenerateLimiter.check(session.user!.id ?? "unknown").allowed) {
    throw new Error("Слишком много перегенераций подряд — подождите минуту");
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен на сервере");
  }
  const apiKey = await requireClaudeApiKey(encryptionKey);

  const [comment, agentConfig, knowledgeDocuments] = await Promise.all([
    prisma.instagramComment.findUniqueOrThrow({ where: { id: commentId } }),
    prisma.agentConfig.findUnique({ where: { singleton: "agent" } }),
    prisma.agentKnowledgeDocument.findMany({ select: { title: true, body: true } }),
  ]);

  // Never resurrect an already-sent comment back into the pending queue.
  if (comment.replyStatus === "sent" || comment.replyStatus === "sending") {
    throw new Error("Этот комментарий уже отправлен или обрабатывается");
  }

  const systemPrompt = buildCommentReplySystemPrompt({
    commentToneAndRules: agentConfig?.commentToneAndRules ?? "",
    knowledgeDocuments,
  });
  const userMessage = buildCommentUserMessage({ text: comment.text, username: comment.username });
  const { reply } = await generateCommentReply(apiKey, systemPrompt, userMessage);

  await prisma.instagramComment.update({
    where: { id: comment.id },
    data: { draftReply: reply, replyStatus: "draft_ready" },
  });

  revalidatePath("/panel/inbox");

  return { draftReply: reply };
}
