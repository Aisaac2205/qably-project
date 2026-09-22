-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "attachedCaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
