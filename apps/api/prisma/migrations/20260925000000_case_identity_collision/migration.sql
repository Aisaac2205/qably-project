-- CreateEnum
CREATE TYPE "CaseCollisionKind" AS ENUM ('identity', 'legacy_key');

-- CreateTable
CREATE TABLE "case_identity_collision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "kind" "CaseCollisionKind" NOT NULL,
    "key" TEXT NOT NULL,
    "claimantCount" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunId" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "case_identity_collision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_identity_collision_suiteId_kind_key_key" ON "case_identity_collision"("suiteId", "kind", "key");

-- CreateIndex
CREATE INDEX "case_identity_collision_projectId_closedAt_idx" ON "case_identity_collision"("projectId", "closedAt");

-- AddForeignKey
ALTER TABLE "case_identity_collision" ADD CONSTRAINT "case_identity_collision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_identity_collision" ADD CONSTRAINT "case_identity_collision_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_identity_collision" ADD CONSTRAINT "case_identity_collision_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
