-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('sent', 'failed');

-- CreateTable
CREATE TABLE "notification_delivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "channel" "NotificationWebhookType" NOT NULL,
    "webhookId" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_delivery_organizationId_dedupeKey_idx" ON "notification_delivery"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "notification_delivery_webhookId_idx" ON "notification_delivery"("webhookId");

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "notification_webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
