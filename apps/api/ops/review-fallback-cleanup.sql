-- Owner-run only. Never executed automatically by this codebase.
-- See docs/OPS_REVIEW_FALLBACK_CLEANUP.md for purpose, pre-checks, how to
-- run and verify, and how to restore from the backup tables.

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
-- If either CREATE TABLE below fails with "relation already exists", a
-- backup from a previous run is still present: stop and restore/drop it
-- first (see the doc) instead of re-running this script.
BEGIN;

CREATE TABLE "backup_fallback_proposal_20260924" AS
SELECT * FROM "extracted_proposal"
WHERE "needsManualReview" = true
  AND "status" = 'in_review'
  AND "chat_case_key" IS NULL;

CREATE TABLE "backup_fallback_evidence_20260924" AS
SELECT e.* FROM "evidence" e
WHERE EXISTS (
  SELECT 1 FROM "backup_fallback_proposal_20260924" p
  WHERE p."evidenceId" = e."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "code_change" c WHERE c."evidenceId" = e."id"
);

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
