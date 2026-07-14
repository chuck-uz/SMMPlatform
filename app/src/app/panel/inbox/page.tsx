import { prisma } from "@/lib/prisma";
import { CommentReviewQueue } from "@/components/CommentReviewQueue";

export default async function InboxPage() {
  const [pending, sent] = await Promise.all([
    prisma.instagramComment.findMany({
      where: { replyStatus: { in: ["draft_ready", "failed"] } },
      orderBy: { postedAt: "desc" },
    }),
    prisma.instagramComment.findMany({
      where: { replyStatus: "sent" },
      orderBy: { repliedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        Ответы на новые комментарии в Instagram генерируются автоматически и ждут вашего
        одобрения здесь — отредактируйте черновик при необходимости и отправьте, либо
        сгенерируйте заново.
      </p>

      <div className="mt-8 max-w-[1020px]">
        <CommentReviewQueue
          pending={pending.map((comment) => ({
            id: comment.id,
            text: comment.text,
            username: comment.username,
            draftReply: comment.draftReply,
            replyStatus: comment.replyStatus,
          }))}
          sent={sent.map((comment) => ({
            id: comment.id,
            text: comment.text,
            username: comment.username,
            draftReply: comment.draftReply,
            replyStatus: comment.replyStatus,
          }))}
        />
      </div>
    </div>
  );
}
