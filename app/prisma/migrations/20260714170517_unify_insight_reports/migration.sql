/*
  Warnings:

  - You are about to drop the `ai_analysis_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `growth_insight_reports` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_analysis_reports" DROP CONSTRAINT "ai_analysis_reports_accountId_fkey";

-- DropForeignKey
ALTER TABLE "growth_insight_reports" DROP CONSTRAINT "growth_insight_reports_accountId_fkey";

-- DropTable
DROP TABLE "ai_analysis_reports";

-- DropTable
DROP TABLE "growth_insight_reports";

-- CreateTable
CREATE TABLE "account_insight_reports" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_insight_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "account_insight_reports" ADD CONSTRAINT "account_insight_reports_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
