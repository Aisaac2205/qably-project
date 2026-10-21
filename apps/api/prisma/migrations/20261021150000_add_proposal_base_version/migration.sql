-- AlterTable
-- The published version a proposal was reviewed against. Nullable, with no
-- default: existing rows stay null, and approval skips the stale check for them.
ALTER TABLE "extracted_proposal" ADD COLUMN "baseVersionId" TEXT;
