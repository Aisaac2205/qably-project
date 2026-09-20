-- AlterTable
ALTER TABLE "run" ADD COLUMN     "reportExternalId" TEXT;

-- CreateIndex
CREATE INDEX "run_projectId_source_reportExternalId_idx" ON "run"("projectId", "source", "reportExternalId");
