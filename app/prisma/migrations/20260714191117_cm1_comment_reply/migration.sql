-- AlterTable
ALTER TABLE "agent_config" ADD COLUMN     "commentModerationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commentToneAndRules" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "instagram_comments" ADD COLUMN     "draftReply" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "replyStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "sentReplyId" TEXT;

-- CM1: comments collected before this migration predate auto-reply — mark them
-- skipped so the poller doesn't retroactively reply to a historical backlog.
UPDATE "instagram_comments" SET "replyStatus" = 'skipped';
