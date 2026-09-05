-- AlterTable
ALTER TABLE "run_case" ADD COLUMN     "className" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "failureDetails" TEXT,
ADD COLUMN     "failureMessage" TEXT,
ADD COLUMN     "failureType" TEXT,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "skipReason" TEXT;
