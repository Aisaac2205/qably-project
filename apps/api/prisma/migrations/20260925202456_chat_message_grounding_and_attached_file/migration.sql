-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "attachedFilePath" TEXT,
ADD COLUMN     "grounding" JSONB;
