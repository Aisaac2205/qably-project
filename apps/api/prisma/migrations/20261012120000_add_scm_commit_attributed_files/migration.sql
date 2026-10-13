-- Additive only: one array column with a constant default on "scm_commit". Nothing is
-- dropped, retyped or backfilled; existing rows read as an empty list. The table is
-- new and small, so the constant default costs no table rewrite worth planning for.

-- AlterTable
ALTER TABLE "scm_commit" ADD COLUMN     "attributedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[];
