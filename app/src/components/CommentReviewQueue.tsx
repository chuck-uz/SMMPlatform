"use client";

import { useState, useTransition } from "react";
import { approveCommentReplyAction, regenerateCommentReplyAction } from "@/app/panel/inbox/actions";

export interface CommentItem {
  id: string;
  text: string;
  username: string | null;
  draftReply: string | null;
  replyStatus: string;
}

function CommentDraftCard({ comment }: { comment: CommentItem }) {
  const [message, setMessage] = useState(comment.draftReply ?? "");
  const [status, setStatus] = useState(comment.replyStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await approveCommentReplyAction({ commentId: comment.id, message });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setStatus("sent");
      } catch {
        setError("Не удалось отправить ответ");
      }
    });
  }

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateCommentReplyAction(comment.id);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setMessage(result.draftReply);
        setStatus("draft_ready");
      } catch {
        setError("Не удалось сгенерировать ответ заново");
      }
    });
  }

  const commentLabel = comment.username ? `${comment.username}: ${comment.text}` : comment.text;

  if (status === "sent") {
    return (
      <div className="rounded-[12px] border border-border bg-card p-4 text-sm">
        <p className="text-muted-foreground">{commentLabel}</p>
        <p className="mt-2 text-foreground">✓ Отправлено: {message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{commentLabel}</p>
      {status === "failed" ? (
        <p className="mt-1 text-xs text-destructive">Не удалось сгенерировать ответ автоматически.</p>
      ) : null}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Черновик ответа…"
        className="mt-3 w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || !message.trim()}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Отправляем…" : "Одобрить и отправить"}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="cursor-pointer rounded-sm border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          Сгенерировать заново
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function CommentReviewQueue({ pending, sent }: { pending: CommentItem[]; sent: CommentItem[] }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[13.5px] font-semibold text-foreground">На проверку ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Нет комментариев, ожидающих проверки.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {pending.map((comment) => (
              <CommentDraftCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[13.5px] font-semibold text-foreground">Недавно отправленные</h2>
        {sent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Пока ничего не отправлено.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {sent.map((comment) => (
              <CommentDraftCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
