-- CreateIndex
CREATE INDEX "review_inbox_keyset_idx" ON "extracted_proposal"("projectId", "status", "createdAt" DESC, "id" DESC);
