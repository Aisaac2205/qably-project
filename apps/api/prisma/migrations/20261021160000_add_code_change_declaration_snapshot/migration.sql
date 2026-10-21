-- Additive only: one nullable JSONB column on "code_change". Nothing is dropped,
-- retyped or backfilled; existing rows read as "no snapshot", so the next push of
-- each file builds its baseline from the source of the previous push instead.
-- Adding a nullable column without a default does not rewrite the table.

-- AlterTable
ALTER TABLE "code_change" ADD COLUMN     "declarationSnapshot" JSONB;
