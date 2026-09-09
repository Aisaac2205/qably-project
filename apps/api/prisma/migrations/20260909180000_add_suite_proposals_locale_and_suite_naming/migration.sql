-- AlterTable
ALTER TABLE "suite" ADD COLUMN     "ingestionKey" TEXT,
ADD COLUMN     "nameSource" TEXT NOT NULL DEFAULT 'ingestion';

-- AlterTable
ALTER TABLE "extracted_proposal" ADD COLUMN     "locale" TEXT,
ADD COLUMN     "observations" JSONB;

-- AlterTable
ALTER TABLE "test_case_version" ADD COLUMN     "locale" TEXT;

-- CreateTable
CREATE TABLE "suite_proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'in_review',
    "evidenceId" TEXT NOT NULL,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "suite_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suite_proposal_projectId_idx" ON "suite_proposal"("projectId");

-- CreateIndex
CREATE INDEX "suite_proposal_projectId_status_idx" ON "suite_proposal"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suite_proposal_suiteId_evidenceId_key" ON "suite_proposal"("suiteId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "suite_projectId_ingestionKey_key" ON "suite"("projectId", "ingestionKey");

-- AddForeignKey
ALTER TABLE "suite_proposal" ADD CONSTRAINT "suite_proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suite_proposal" ADD CONSTRAINT "suite_proposal_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suite_proposal" ADD CONSTRAINT "suite_proposal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every suite that already owns an automated case was created by ingestion under its current name
UPDATE "suite" SET "ingestionKey" = "name"
WHERE "id" IN (SELECT DISTINCT "suiteId" FROM "test_case" WHERE "executionMode" = 'automated');
