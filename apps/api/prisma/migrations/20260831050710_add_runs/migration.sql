-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'pass', 'fail');

-- CreateEnum
CREATE TYPE "RunCaseStatus" AS ENUM ('pending', 'running', 'pass', 'fail', 'skip', 'blocked');

-- CreateEnum
CREATE TYPE "RunSource" AS ENUM ('manual', 'api', 'github_actions');

-- CreateTable
CREATE TABLE "run" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "source" "RunSource" NOT NULL,
    "externalId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthor" TEXT,

    CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_case" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT,
    "name" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "status" "RunCaseStatus" NOT NULL DEFAULT 'pending',
    "position" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3),

    CONSTRAINT "run_case_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_projectId_startedAt_idx" ON "run"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "run_organizationId_idx" ON "run"("organizationId");

-- CreateIndex
CREATE INDEX "run_commitSha_idx" ON "run"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "run_projectId_source_externalId_key" ON "run"("projectId", "source", "externalId");

-- CreateIndex
CREATE INDEX "run_case_runId_idx" ON "run_case"("runId");

-- CreateIndex
CREATE INDEX "run_case_testCaseId_idx" ON "run_case"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "run_case_runId_position_key" ON "run_case"("runId", "position");

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_case" ADD CONSTRAINT "run_case_runId_fkey" FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_case" ADD CONSTRAINT "run_case_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
