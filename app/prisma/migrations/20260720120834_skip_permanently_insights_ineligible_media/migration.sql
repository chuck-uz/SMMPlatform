-- AlterTable
ALTER TABLE "instagram_media" ADD COLUMN     "insightsUnavailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insightsUnavailableReason" TEXT;
