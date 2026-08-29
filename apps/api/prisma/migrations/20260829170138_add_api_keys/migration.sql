-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lookupId" TEXT NOT NULL,
    "hashedSecret" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_projectId_idx" ON "api_key"("projectId");

-- CreateIndex
CREATE INDEX "api_key_organizationId_idx" ON "api_key"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_lookupId_key" ON "api_key"("lookupId");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
