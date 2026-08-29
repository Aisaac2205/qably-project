/*
  Warnings:

  - You are about to drop the column `encryptedToken` on the `connection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "connection" DROP COLUMN "encryptedToken";
