/*
  Warnings:

  - Added the required column `encryptedWebhookSecret` to the `connection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "encryptedWebhookSecret" TEXT NOT NULL;
