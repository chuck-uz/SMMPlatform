-- DropForeignKey
ALTER TABLE "account_insight_reports" DROP CONSTRAINT "account_insight_reports_accountId_fkey";

-- DropForeignKey
ALTER TABLE "instagram_comments" DROP CONSTRAINT "instagram_comments_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "instagram_media" DROP CONSTRAINT "instagram_media_accountId_fkey";

-- DropForeignKey
ALTER TABLE "instagram_metric_snapshots" DROP CONSTRAINT "instagram_metric_snapshots_accountId_fkey";

-- DropForeignKey
ALTER TABLE "instagram_metric_snapshots" DROP CONSTRAINT "instagram_metric_snapshots_mediaId_fkey";

-- AddForeignKey
ALTER TABLE "instagram_media" ADD CONSTRAINT "instagram_media_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comments" ADD CONSTRAINT "instagram_comments_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "instagram_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_metric_snapshots" ADD CONSTRAINT "instagram_metric_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_metric_snapshots" ADD CONSTRAINT "instagram_metric_snapshots_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "instagram_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_insight_reports" ADD CONSTRAINT "account_insight_reports_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
