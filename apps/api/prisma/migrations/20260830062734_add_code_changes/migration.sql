-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SOURCE_EXCERPT', 'ARTIFACT', 'URL');

-- CreateEnum
CREATE TYPE "IngestionSource" AS ENUM ('REPOSITORY', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IngestionBatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "testFilePatterns" TEXT[] DEFAULT ARRAY['*.spec.ts', '*.test.ts']::TEXT[];

-- AlterTable
ALTER TABLE "scm_event" ADD COLUMN     "changedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "excerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_batch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scmEventId" TEXT,
    "source" "IngestionSource" NOT NULL,
    "status" "IngestionBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_change" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "pullRequestNumber" INTEGER,
    "commitSha" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "diff" TEXT NOT NULL DEFAULT '',
    "detectedPattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_projectId_idx" ON "evidence"("projectId");

-- CreateIndex
CREATE INDEX "ingestion_batch_projectId_idx" ON "ingestion_batch"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_batch_scmEventId_projectId_key" ON "ingestion_batch"("scmEventId", "projectId");

-- CreateIndex
CREATE INDEX "code_change_projectId_idx" ON "code_change"("projectId");

-- CreateIndex
CREATE INDEX "code_change_batchId_idx" ON "code_change"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "code_change_batchId_filePath_key" ON "code_change"("batchId", "filePath");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_batch" ADD CONSTRAINT "ingestion_batch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_batch" ADD CONSTRAINT "ingestion_batch_scmEventId_fkey" FOREIGN KEY ("scmEventId") REFERENCES "scm_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_change" ADD CONSTRAINT "code_change_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_change" ADD CONSTRAINT "code_change_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ingestion_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_change" ADD CONSTRAINT "code_change_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
