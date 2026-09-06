-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('manual', 'automated');

-- AlterTable
ALTER TABLE "test_case" ADD COLUMN     "executionMode" "ExecutionMode" NOT NULL DEFAULT 'manual',
ADD COLUMN     "automationKey" TEXT,
ADD COLUMN     "automationClassName" TEXT,
ADD COLUMN     "automationFilePath" TEXT;

UPDATE "test_case" tc
SET "executionMode" = 'automated',
    "automationKey" = tc."name"
WHERE EXISTS (
  SELECT 1
  FROM "run" r
  WHERE r."suiteId" = tc."suiteId"
    AND r."source" <> 'manual'
);

-- CreateIndex
CREATE UNIQUE INDEX "test_case_suiteId_automationKey_key" ON "test_case"("suiteId", "automationKey");
