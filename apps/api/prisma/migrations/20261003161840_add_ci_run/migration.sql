-- AlterTable
ALTER TABLE "run" ADD COLUMN     "ciJobKey" TEXT,
ADD COLUMN     "ciRunId" TEXT;

-- CreateTable
CREATE TABLE "ci_run" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "RunSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "workflowName" TEXT,
    "runNumber" INTEGER,
    "runAttempt" INTEGER,
    "branch" TEXT,
    "headRef" TEXT,
    "actor" TEXT,
    "eventName" TEXT,
    "serverUrl" TEXT,
    "repository" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthor" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ci_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ci_run_projectId_startedAt_idx" ON "ci_run"("projectId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ci_run_projectId_source_externalId_key" ON "ci_run"("projectId", "source", "externalId");

-- CreateIndex
CREATE INDEX "run_ciRunId_idx" ON "run"("ciRunId");

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_ciRunId_fkey" FOREIGN KEY ("ciRunId") REFERENCES "ci_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ci_run" ADD CONSTRAINT "ci_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ci_run" ADD CONSTRAINT "ci_run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
