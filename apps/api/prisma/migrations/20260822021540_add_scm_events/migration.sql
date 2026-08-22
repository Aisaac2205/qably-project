-- CreateEnum
CREATE TYPE "ScmEventKind" AS ENUM ('PUSH', 'PULL_REQUEST');

-- CreateEnum
CREATE TYPE "ScmEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "scm_event" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "ScmEventKind" NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ScmEventStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scm_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_event_organizationId_idx" ON "scm_event"("organizationId");

-- CreateIndex
CREATE INDEX "scm_event_connectionId_idx" ON "scm_event"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "scm_event_provider_eventId_key" ON "scm_event"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "scm_event" ADD CONSTRAINT "scm_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
