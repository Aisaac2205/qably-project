-- AlterTable
ALTER TABLE "notification_delivery"
  ADD COLUMN "userId" TEXT,
  ALTER COLUMN "webhookId" DROP NOT NULL,
  ALTER COLUMN "channel" TYPE "NotificationChannel" USING ("channel"::text::"NotificationChannel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_userId_dedupeKey_channel_key" ON "notification_delivery"("userId", "dedupeKey", "channel");

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
