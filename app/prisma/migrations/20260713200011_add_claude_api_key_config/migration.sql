-- CreateTable
CREATE TABLE "claude_api_key_config" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'claude',
    "encryptedApiKey" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claude_api_key_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claude_api_key_config_singleton_key" ON "claude_api_key_config"("singleton");
