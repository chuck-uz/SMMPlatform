-- CreateIndex
CREATE INDEX "account_insight_reports_accountId_trigger_createdAt_idx" ON "account_insight_reports"("accountId", "trigger", "createdAt");

-- CreateIndex
CREATE INDEX "instagram_comments_mediaId_idx" ON "instagram_comments"("mediaId");

-- CreateIndex
CREATE INDEX "instagram_comments_replyStatus_idx" ON "instagram_comments"("replyStatus");

-- CreateIndex
CREATE INDEX "instagram_media_accountId_idx" ON "instagram_media"("accountId");

-- CreateIndex
CREATE INDEX "instagram_metric_snapshots_accountId_scope_capturedAt_idx" ON "instagram_metric_snapshots"("accountId", "scope", "capturedAt");

-- CreateIndex
CREATE INDEX "instagram_metric_snapshots_mediaId_idx" ON "instagram_metric_snapshots"("mediaId");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");
