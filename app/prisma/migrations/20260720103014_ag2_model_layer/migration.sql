-- CreateTable
CREATE TABLE "llm_provider_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_route_configs" (
    "id" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_route_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_comparison_runs" (
    "id" TEXT NOT NULL,
    "scenarioSource" TEXT NOT NULL,
    "scenarioTurns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_comparison_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_comparison_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "reply" TEXT,
    "fields" JSONB,
    "mechanism" TEXT NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_comparison_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_provider_credentials_provider_key" ON "llm_provider_credentials"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "llm_route_configs_interactionType_key" ON "llm_route_configs"("interactionType");

-- CreateIndex
CREATE INDEX "model_comparison_runs_createdAt_idx" ON "model_comparison_runs"("createdAt");

-- CreateIndex
CREATE INDEX "model_comparison_results_runId_idx" ON "model_comparison_results"("runId");

-- AddForeignKey
ALTER TABLE "model_comparison_results" ADD CONSTRAINT "model_comparison_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "model_comparison_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default routes so behaviour is identical to before this migration:
-- agent dialog and comment replies ran on Haiku, analytics on Sonnet, all via Anthropic.
INSERT INTO "llm_route_configs" ("id", "interactionType", "provider", "model", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'agent_dialog',  'anthropic', 'claude-haiku-4-5-20251001', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'comment_reply', 'anthropic', 'claude-haiku-4-5-20251001', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'analytics',     'anthropic', 'claude-sonnet-5',           CURRENT_TIMESTAMP)
ON CONFLICT ("interactionType") DO NOTHING;

-- Carry the already-configured Claude key over to the generalised credential store,
-- so the admin does not have to re-enter it. claude_api_key_config is left in place
-- until the call sites stop reading it; it is dropped in a follow-up migration.
INSERT INTO "llm_provider_credentials" ("id", "provider", "encryptedApiKey", "verified", "verifiedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'anthropic', "encryptedApiKey", "verified", "verifiedAt", "createdAt", CURRENT_TIMESTAMP
FROM "claude_api_key_config"
ON CONFLICT ("provider") DO NOTHING;
