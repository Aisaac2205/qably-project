-- AlterTable
ALTER TABLE "extracted_proposal" ADD COLUMN     "chat_case_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "extracted_proposal_chat_case_key_key" ON "extracted_proposal"("chat_case_key");
