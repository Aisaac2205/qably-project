-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "aiCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
