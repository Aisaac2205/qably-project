-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('in_review', 'approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "ReviewDecisionAction" AS ENUM ('approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "TraceabilityEntityType" AS ENUM ('code_change', 'evidence', 'proposal', 'test_case', 'test_case_version', 'run', 'run_case', 'quality_risk');

-- CreateEnum
CREATE TYPE "TraceabilityRelation" AS ENUM ('evidence_for', 'produced', 'version_of', 'executed_as', 'signals');

-- AlterTable
ALTER TABLE "test_case" ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- Backfill
UPDATE "test_case" AS tc
SET "projectId" = s."projectId"
FROM "suite" AS s
WHERE tc."suiteId" = s."id" AND tc."projectId" IS NULL;

-- AlterColumn
ALTER TABLE "test_case" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateTable
CREATE TABLE "extracted_proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "codeChangeId" TEXT,
    "targetTestCaseId" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'in_review',
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "priority" "CasePriority" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ReviewDecisionAction" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_version" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "priority" "CasePriority" NOT NULL DEFAULT 'medium',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traceability_link" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromType" "TraceabilityEntityType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" "TraceabilityEntityType" NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" "TraceabilityRelation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traceability_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extracted_proposal_codeChangeId_key" ON "extracted_proposal"("codeChangeId");

-- CreateIndex
CREATE INDEX "extracted_proposal_projectId_idx" ON "extracted_proposal"("projectId");

-- CreateIndex
CREATE INDEX "extracted_proposal_projectId_status_idx" ON "extracted_proposal"("projectId", "status");

-- CreateIndex
CREATE INDEX "extracted_proposal_targetTestCaseId_idx" ON "extracted_proposal"("targetTestCaseId");

-- CreateIndex
CREATE INDEX "review_decision_proposalId_idx" ON "review_decision"("proposalId");

-- CreateIndex
CREATE INDEX "review_decision_actorId_idx" ON "review_decision"("actorId");

-- CreateIndex
CREATE INDEX "test_case_version_testCaseId_idx" ON "test_case_version"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_version_testCaseId_version_key" ON "test_case_version"("testCaseId", "version");

-- CreateIndex
CREATE INDEX "traceability_link_projectId_idx" ON "traceability_link"("projectId");

-- CreateIndex
CREATE INDEX "traceability_link_fromType_fromId_idx" ON "traceability_link"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "traceability_link_toType_toId_idx" ON "traceability_link"("toType", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "traceability_link_fromType_fromId_toType_toId_relation_key" ON "traceability_link"("fromType", "fromId", "toType", "toId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_currentVersionId_key" ON "test_case"("currentVersionId");

-- CreateIndex
CREATE INDEX "test_case_projectId_idx" ON "test_case"("projectId");

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "test_case_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_codeChangeId_fkey" FOREIGN KEY ("codeChangeId") REFERENCES "code_change"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_targetTestCaseId_fkey" FOREIGN KEY ("targetTestCaseId") REFERENCES "test_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "extracted_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_version" ADD CONSTRAINT "test_case_version_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_link" ADD CONSTRAINT "traceability_link_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
