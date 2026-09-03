-- DropIndex
DROP INDEX "notification_userId_dedupeKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "notification_userId_organizationId_dedupeKey_key" ON "notification"("userId", "organizationId", "dedupeKey");
