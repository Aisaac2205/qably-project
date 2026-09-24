-- CreateEnum
CREATE TYPE "ProposalDuplicateKind" AS ENUM ('none', 'update', 'possible_duplicate');

-- AlterTable
ALTER TABLE "extracted_proposal" ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "duplicateKind" "ProposalDuplicateKind",
ADD COLUMN     "duplicateReasons" JSONB,
ADD COLUMN     "duplicateScore" DOUBLE PRECISION,
ADD COLUMN     "matchedCaseId" TEXT;

-- CreateIndex
CREATE INDEX "extracted_proposal_matchedCaseId_idx" ON "extracted_proposal"("matchedCaseId");

-- AddForeignKey
ALTER TABLE "extracted_proposal" ADD CONSTRAINT "extracted_proposal_matchedCaseId_fkey" FOREIGN KEY ("matchedCaseId") REFERENCES "test_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
