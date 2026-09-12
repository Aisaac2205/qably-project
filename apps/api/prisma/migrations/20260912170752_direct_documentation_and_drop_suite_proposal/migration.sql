-- AlterTable
ALTER TABLE "suite" ADD COLUMN     "documentationConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "documentationConfirmedById" TEXT;

-- AlterTable
ALTER TABLE "test_case" ADD COLUMN     "documentationSource" TEXT NOT NULL DEFAULT 'ingestion';

-- Backfill: a case whose current version already carries a locale was
-- documented by an Aeris job (review approve or the earlier proposal-based
-- document-file flow); every other case keeps the column default.
UPDATE "test_case"
SET "documentationSource" = 'aeris'
WHERE "currentVersionId" IN (
  SELECT "id" FROM "test_case_version" WHERE "locale" IS NOT NULL
);

-- DropForeignKey
ALTER TABLE "suite_proposal" DROP CONSTRAINT "suite_proposal_evidenceId_fkey";

-- DropForeignKey
ALTER TABLE "suite_proposal" DROP CONSTRAINT "suite_proposal_projectId_fkey";

-- DropForeignKey
ALTER TABLE "suite_proposal" DROP CONSTRAINT "suite_proposal_suiteId_fkey";

-- DropTable
DROP TABLE "suite_proposal";
