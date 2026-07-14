-- CreateTable
CREATE TABLE "instagram_media" (
    "id" TEXT NOT NULL,
    "instagramMediaId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "mediaProductType" TEXT,
    "caption" TEXT,
    "permalink" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comments" (
    "id" TEXT NOT NULL,
    "instagramCommentId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "username" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_metric_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mediaId" TEXT,
    "scope" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_media_instagramMediaId_key" ON "instagram_media"("instagramMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_comments_instagramCommentId_key" ON "instagram_comments"("instagramCommentId");

-- AddForeignKey
ALTER TABLE "instagram_media" ADD CONSTRAINT "instagram_media_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comments" ADD CONSTRAINT "instagram_comments_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "instagram_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_metric_snapshots" ADD CONSTRAINT "instagram_metric_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_metric_snapshots" ADD CONSTRAINT "instagram_metric_snapshots_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "instagram_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
