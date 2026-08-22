-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "CaseState" AS ENUM ('active', 'draft', 'deprecated');

-- CreateTable
CREATE TABLE "suite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "priority" "CasePriority" NOT NULL DEFAULT 'medium',
    "state" "CaseState" NOT NULL DEFAULT 'active',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suite_projectId_idx" ON "suite"("projectId");

-- CreateIndex
CREATE INDEX "suite_organizationId_idx" ON "suite"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "suite_projectId_name_key" ON "suite"("projectId", "name");

-- CreateIndex
CREATE INDEX "test_case_suiteId_idx" ON "test_case"("suiteId");

-- CreateIndex
CREATE INDEX "test_case_suiteId_position_idx" ON "test_case"("suiteId", "position");

-- AddForeignKey
ALTER TABLE "suite" ADD CONSTRAINT "suite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suite" ADD CONSTRAINT "suite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
