-- Owner-run only. Never executed automatically by this codebase.
-- Removes legacy manual-review fallback proposals — the kind
-- ExtractionFailureRecorder stopped creating once S2a landed
-- (needsManualReview=true, still in_review, not a chat-case proposal).
-- Idempotent: running it again after a successful run finds zero
-- matching rows and performs no writes.
--
-- Column/table names verified against:
--   prisma/migrations/20260904150000_add_review_domain/migration.sql
--   prisma/migrations/20260905200000_add_ai_extraction/migration.sql
--   prisma/migrations/20260906150000_add_proposal_chat_case_key/migration.sql
--   prisma/migrations/20260830062734_add_code_changes/migration.sql
--   prisma/migrations/20260920051954_aeris_documentation_state/migration.sql

-- 1. Dry run: review these counts before running anything below.
SELECT
  (SELECT count(*) FROM "extracted_proposal"
    WHERE "needsManualReview" = true
      AND "status" = 'in_review'
      AND "chat_case_key" IS NULL) AS fallback_proposals_to_delete,
  (SELECT count(*) FROM "evidence" e
    WHERE EXISTS (
      SELECT 1 FROM "extracted_proposal" p
      WHERE p."evidenceId" = e."id"
        AND p."needsManualReview" = true
        AND p."status" = 'in_review'
        AND p."chat_case_key" IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM "code_change" c WHERE c."evidenceId" = e."id"
    )) AS orphan_evidence_rows_to_delete;

-- 2-5. Actual cleanup. Run only after reviewing the dry-run counts above.
BEGIN;

DROP TABLE IF EXISTS "backup_fallback_proposal_20260924";
CREATE TABLE "backup_fallback_proposal_20260924" AS
SELECT * FROM "extracted_proposal"
WHERE "needsManualReview" = true
  AND "status" = 'in_review'
  AND "chat_case_key" IS NULL;

-- Evidence backed up here is only the evidence created as part of a
-- fallback (createFallbackEvidence, now removed). Evidence a code_change
-- row still points to is real source-excerpt evidence and must survive.
DROP TABLE IF EXISTS "backup_fallback_evidence_20260924";
CREATE TABLE "backup_fallback_evidence_20260924" AS
SELECT e.* FROM "evidence" e
WHERE EXISTS (
  SELECT 1 FROM "backup_fallback_proposal_20260924" p
  WHERE p."evidenceId" = e."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "code_change" c WHERE c."evidenceId" = e."id"
);

-- Mark each fallback proposal's target case failed with the fallback's
-- objective as the skip reason, mirroring what ExtractionFailureRecorder
-- would have written directly had it existed when these rows were
-- created. Never touches a case a human already documented, and never
-- clobbers an outcome a fresher job already recorded.
UPDATE "test_case" t
SET
  "documentationOutcome" = 'failed',
  "documentationSkipReason" = p."objective",
  "documentationOutcomeAt" = now(),
  "documentationQueuedAt" = NULL
FROM "backup_fallback_proposal_20260924" p
WHERE t."id" = p."targetTestCaseId"
  AND t."documentationOutcome" IS NULL
  AND t."documentationSource" <> 'human';

DELETE FROM "extracted_proposal" p
WHERE p."id" IN (SELECT "id" FROM "backup_fallback_proposal_20260924");

DELETE FROM "evidence" e
WHERE e."id" IN (SELECT "id" FROM "backup_fallback_evidence_20260924");

COMMIT;
