-- CreateTable
CREATE TABLE "growth_insight_reports" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_insight_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "growth_insight_reports" ADD CONSTRAINT "growth_insight_reports_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
