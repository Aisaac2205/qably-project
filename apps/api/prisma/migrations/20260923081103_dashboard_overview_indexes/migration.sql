-- CreateIndex
CREATE INDEX "notification_delivery_organizationId_deliveredAt_idx" ON "notification_delivery"("organizationId", "deliveredAt");

-- CreateIndex
CREATE INDEX "run_suiteId_startedAt_idx" ON "run"("suiteId", "startedAt");
