-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('GITHUB', 'BITBUCKET');

-- CreateTable
CREATE TABLE "connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connection_organizationId_idx" ON "connection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "connection_organizationId_provider_repo_key" ON "connection"("organizationId", "provider", "repo");

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
