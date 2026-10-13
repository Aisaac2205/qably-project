-- Additive only: two nullable columns on "run_case", one index and one foreign
-- key that validates trivially (the new column is NULL on every existing row).
-- Nothing is dropped, retyped, rewritten or backfilled, so existing rows are untouched.

-- AlterTable
ALTER TABLE "run_case" ADD COLUMN     "catalogSnapshot" JSONB,
ADD COLUMN     "testCaseVersionId" TEXT;

-- CreateIndex
CREATE INDEX "run_case_testCaseVersionId_idx" ON "run_case"("testCaseVersionId");

-- AddForeignKey
ALTER TABLE "run_case" ADD CONSTRAINT "run_case_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "test_case_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
