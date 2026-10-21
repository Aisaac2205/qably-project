-- Additive only: one nullable column on "scm_event", no default and no backfill.
-- Existing rows read as NULL, which the ingestion processor treats as "default
-- branch unknown" and keeps extracting for, so nothing changes for stored events.

-- AlterTable
ALTER TABLE "scm_event" ADD COLUMN     "defaultBranch" TEXT;
