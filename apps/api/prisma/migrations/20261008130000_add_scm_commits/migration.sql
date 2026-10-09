-- Additive only: new nullable or constant-default columns on "scm_event" and a new
-- "scm_commit" table. Nothing is dropped, retyped, rewritten or backfilled, so
-- existing rows are untouched.

-- AlterTable
ALTER TABLE "scm_event" ADD COLUMN     "beforeSha" TEXT,
ADD COLUMN     "commitsTruncated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forced" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "scm_commit" (
    "id" TEXT NOT NULL,
    "scmEventId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "url" TEXT,

    CONSTRAINT "scm_commit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_commit_sha_idx" ON "scm_commit"("sha");

-- CreateIndex
CREATE UNIQUE INDEX "scm_commit_scmEventId_sha_key" ON "scm_commit"("scmEventId", "sha");

-- AddForeignKey
ALTER TABLE "scm_commit" ADD CONSTRAINT "scm_commit_scmEventId_fkey" FOREIGN KEY ("scmEventId") REFERENCES "scm_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
