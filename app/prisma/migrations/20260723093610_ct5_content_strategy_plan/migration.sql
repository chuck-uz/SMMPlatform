-- CreateTable
CREATE TABLE "content_strategy" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'content',
    "brandVoice" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "goal" TEXT NOT NULL DEFAULT '',
    "seasonal" TEXT NOT NULL DEFAULT '',
    "avoidTopics" TEXT NOT NULL DEFAULT '',
    "postsPerWeek" INTEGER NOT NULL DEFAULT 3,
    "pillars" JSONB NOT NULL DEFAULT '[]',
    "formats" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plans" (
    "id" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "slotDate" TIMESTAMP(3) NOT NULL,
    "rubric" TEXT NOT NULL DEFAULT '',
    "idea" TEXT NOT NULL DEFAULT '',
    "captionDraft" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT 'photo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "content_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_strategy_singleton_key" ON "content_strategy"("singleton");

-- CreateIndex
CREATE INDEX "content_plans_createdAt_idx" ON "content_plans"("createdAt");

-- CreateIndex
CREATE INDEX "content_plan_items_planId_idx" ON "content_plan_items"("planId");

-- AddForeignKey
ALTER TABLE "content_plan_items" ADD CONSTRAINT "content_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "content_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
