-- AlterTable
ALTER TABLE "suite_proposal" ADD COLUMN     "locale" TEXT;

-- CreateIndex
-- Prisma cannot express partial indexes in schema.prisma, so this lives only
-- in the migration SQL: at most one suite proposal may be pending (in_review)
-- per suite at a time. Concurrent document-file jobs for different files of
-- the same suite race past the application-level pending check without this;
-- the processor catches the resulting P2002 and treats it as "already pending".
CREATE UNIQUE INDEX "suite_proposal_one_pending_per_suite" ON "suite_proposal"("suiteId") WHERE "status" = 'in_review';
