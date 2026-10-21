-- AlterTable
-- The published version of the target case an approval replaced. Nullable,
-- with no default: existing rows stay null, and it is written only on approval.
ALTER TABLE "extracted_proposal" ADD COLUMN "supersededVersionId" TEXT;
