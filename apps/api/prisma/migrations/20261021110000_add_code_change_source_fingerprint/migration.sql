-- Additive only: two nullable columns on "code_change" and one index. Nothing is
-- dropped, retyped or backfilled; existing rows read as "never fingerprinted", so
-- the first push after the deploy extracts each file once and records its hash.
-- Adding a nullable column without a default does not rewrite the table.

-- AlterTable
ALTER TABLE "code_change" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "sourceHash" TEXT;

-- CreateIndex
CREATE INDEX "code_change_projectId_filePath_idx" ON "code_change"("projectId", "filePath");
