-- DropIndex
DROP INDEX "notification_delivery_webhookId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_webhookId_dedupeKey_key" ON "notification_delivery"("webhookId", "dedupeKey");
