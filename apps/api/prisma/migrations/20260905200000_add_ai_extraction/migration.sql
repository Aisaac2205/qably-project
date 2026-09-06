-- AlterTable
ALTER TABLE "connection" ADD COLUMN "encryptedAccessToken" TEXT;

-- DropIndex
DROP INDEX "extracted_proposal_codeChangeId_key";

-- AlterTable
ALTER TABLE "extracted_proposal"
  ADD COLUMN "suiteId" TEXT,
  ADD COLUMN "automationKey" TEXT,
  ADD COLUMN "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promptVersion" TEXT;

-- CreateIndex
CREATE INDEX "extracted_proposal_codeChangeId_idx" ON "extracted_proposal"("codeChangeId");

-- CreateIndex
CREATE INDEX "extracted_proposal_suiteId_idx" ON "extracted_proposal"("suiteId");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_proposal_codeChangeId_automationKey_key" ON "extracted_proposal"("codeChangeId", "automationKey");

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "suite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
