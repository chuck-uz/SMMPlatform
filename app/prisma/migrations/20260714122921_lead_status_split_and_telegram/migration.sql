/*
  Warnings:

  - Added the required column `source` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "completeness" TEXT NOT NULL DEFAULT 'partial',
ADD COLUMN     "source" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'new';

-- CreateTable
CREATE TABLE "telegram_bot_config" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'telegram',
    "encryptedBotToken" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_notification_recipients" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_config_singleton_key" ON "telegram_bot_config"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_notification_recipients_chatId_key" ON "telegram_notification_recipients"("chatId");
