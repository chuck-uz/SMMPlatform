-- AlterTable
ALTER TABLE "agent_sandbox_sessions" ADD COLUMN     "leadFields" JSONB;

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "destination" TEXT,
    "people" TEXT,
    "dates" TEXT,
    "budget" TEXT,
    "contact" TEXT,
    "wishes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'partial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_conversationId_key" ON "leads"("conversationId");
