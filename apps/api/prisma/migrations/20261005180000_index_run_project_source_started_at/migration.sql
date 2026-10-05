-- CreateIndex
CREATE INDEX "run_projectId_source_startedAt_idx" ON "run"("projectId", "source", "startedAt");
