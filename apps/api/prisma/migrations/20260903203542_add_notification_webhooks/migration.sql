-- CreateEnum
CREATE TYPE "NotificationWebhookType" AS ENUM ('slack', 'discord');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannel" ADD VALUE 'slack';
ALTER TYPE "NotificationChannel" ADD VALUE 'discord';

-- CreateTable
CREATE TABLE "notification_webhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "NotificationWebhookType" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eventTypes" "NotificationEventType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_webhook_organizationId_idx" ON "notification_webhook"("organizationId");

-- AddForeignKey
ALTER TABLE "notification_webhook" ADD CONSTRAINT "notification_webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
