-- AlterTable
ALTER TABLE "suite" ADD COLUMN     "documentationMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "documentationOutcome" TEXT,
ADD COLUMN     "documentationOutcomeAt" TIMESTAMP(3),
ADD COLUMN     "documentationQueuedAt" TIMESTAMP(3),
ADD COLUMN     "documentationSkipReason" TEXT;

-- AlterTable
ALTER TABLE "test_case" ADD COLUMN     "documentationMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "documentationOutcome" TEXT,
ADD COLUMN     "documentationOutcomeAt" TIMESTAMP(3),
ADD COLUMN     "documentationQueuedAt" TIMESTAMP(3),
ADD COLUMN     "documentationSkipReason" TEXT;
