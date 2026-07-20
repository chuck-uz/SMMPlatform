"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { buildCommentReplySystemPrompt, buildCommentUserMessage } from "@/lib/commentReply";
import { generateCommentReply } from "@/lib/commentReplyClient";
import { instagramContentClient } from "@/lib/instagramContentClient";
import { createRateLimiter } from "@/lib/rateLimiter";

// These actions return { error } instead of throwing user-facing messages:
// Next.js redacts thrown Server Action error messages to a generic digest in
// production, so a returned value is the only way the operator sees the reason.
export type ActionError = { error: string };

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

export async function approveCommentReplyAction(
  params: { commentId: string; message: string },
): Promise<{ ok: true } | ActionError> {
  await requireSession();

  if (!params.message.trim()) {
    return { error: "Текст ответа не может быть пустым" };
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return { error: "Сервер не настроен (ENCRYPTION_KEY). Обратитесь к администратору." };
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
    return { error: "Этот комментарий уже отправлен или обрабатывается" };
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
    console.error(`[inbox] approve failed for comment ${params.commentId}`, error);
    return { error: "Не удалось отправить ответ в Instagram — попробуйте ещё раз" };
  }

  revalidatePath("/panel/inbox");
  return { ok: true };
}

export async function regenerateCommentReplyAction(
  commentId: string,
): Promise<{ draftReply: string } | ActionError> {
  const session = await requireSession();

  if (!regenerateLimiter.check(session.user!.id ?? "unknown").allowed) {
    return { error: "Слишком много перегенераций подряд — подождите минуту" };
  }

  const [comment, agentConfig, knowledgeDocuments] = await Promise.all([
    prisma.instagramComment.findUniqueOrThrow({ where: { id: commentId } }),
    prisma.agentConfig.findUnique({ where: { singleton: "agent" } }),
    prisma.agentKnowledgeDocument.findMany({ select: { title: true, body: true } }),
  ]);

  // Never resurrect an already-sent comment back into the pending queue.
  if (comment.replyStatus === "sent" || comment.replyStatus === "sending") {
    return { error: "Этот комментарий уже отправлен или обрабатывается" };
  }

  const systemPrompt = buildCommentReplySystemPrompt({
    commentToneAndRules: agentConfig?.commentToneAndRules ?? "",
    knowledgeDocuments,
  });
  const userMessage = buildCommentUserMessage({ text: comment.text, username: comment.username });

  let reply: string;
  try {
    ({ reply } = await generateCommentReply(systemPrompt, userMessage));
  } catch (error) {
    console.error(`[inbox] regenerate failed for comment ${commentId}`, error);
    return { error: "Не удалось сгенерировать ответ заново — попробуйте ещё раз" };
  }

  await prisma.instagramComment.update({
    where: { id: comment.id },
    data: { draftReply: reply, replyStatus: "draft_ready" },
  });

  revalidatePath("/panel/inbox");

  return { draftReply: reply };
}
