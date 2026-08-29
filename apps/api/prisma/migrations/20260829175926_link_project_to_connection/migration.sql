/*
  Warnings:

  - You are about to drop the column `githubRepo` on the `project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "project" DROP COLUMN "githubRepo",
ADD COLUMN     "connectionId" TEXT;

-- CreateIndex
CREATE INDEX "project_connectionId_idx" ON "project"("connectionId");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
