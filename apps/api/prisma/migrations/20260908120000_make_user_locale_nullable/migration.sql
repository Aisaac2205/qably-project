-- AlterTable
ALTER TABLE "user" ALTER COLUMN "locale" DROP DEFAULT,
ALTER COLUMN "locale" DROP NOT NULL;

UPDATE "user" SET "locale" = NULL;
