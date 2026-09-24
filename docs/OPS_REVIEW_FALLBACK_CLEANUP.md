# Ops: review-fallback-cleanup.sql

Owner-run only. Never executed automatically by this codebase.

## Purpose

Removes legacy manual-review fallback proposals — the kind
`ExtractionFailureRecorder` stopped creating once S2a landed
(`needsManualReview=true`, still `in_review`, not a chat-case proposal).
Every one of these proposals has `steps=[]`, so approving it always fails
with `incomplete-proposal`; none of them can ever be published. Their
target case is instead marked `documentationOutcome='failed'` with the
fallback's `objective` as the skip reason, mirroring what
`ExtractionFailureRecorder` would have written directly had it existed
when these rows were created.

The evidence rows backed up and deleted are only the evidence created as
part of a fallback (`createFallbackEvidence`, now removed). Evidence a
`code_change` row still points to is real source-excerpt evidence and
must survive — it is excluded from both the backup and the delete.

The `UPDATE` never touches a case a human already documented
(`documentationSource <> 'human'`), and never clobbers an outcome a
fresher job already recorded (`documentationOutcome IS NULL`).

## Column/table names verified against

- `prisma/migrations/20260904150000_add_review_domain/migration.sql`
- `prisma/migrations/20260905200000_add_ai_extraction/migration.sql`
- `prisma/migrations/20260906150000_add_proposal_chat_case_key/migration.sql`
- `prisma/migrations/20260830062734_add_code_changes/migration.sql`
- `prisma/migrations/20260920051954_aeris_documentation_state/migration.sql`

## Pre-checks

1. Confirm `DATABASE_URL` points at the intended database. Never run this
   against a shared database without the owner's explicit sign-off.
2. Run the dry-run `SELECT` at the top of the file first and review the
   counts before running anything else.
3. Confirm no backup tables from a previous run are still present:
   ```sql
   SELECT to_regclass('"backup_fallback_proposal_20260924"');
   SELECT to_regclass('"backup_fallback_evidence_20260924"');
   ```
   Both must return `NULL`. The script is intentionally **not**
   idempotent — it does not `DROP TABLE IF EXISTS` before creating the
   backups, so a second run against a database that still has a backup
   from a prior run fails loudly on `CREATE TABLE` (`relation already
   exists`) before any `DELETE` runs, instead of silently overwriting
   that backup.

## How to run

```sh
psql "$DATABASE_URL" -f apps/api/ops/review-fallback-cleanup.sql
```

Run the dry-run `SELECT` (statement 1) on its own first. Only run the
`BEGIN`/`COMMIT` block afterward, once the counts look right.

## How to verify

After the script commits:

```sql
SELECT count(*) FROM "extracted_proposal"
  WHERE "needsManualReview" = true AND "status" = 'in_review' AND "chat_case_key" IS NULL;
-- expect 0

SELECT count(*) FROM "backup_fallback_proposal_20260924";
-- expect the same count the dry-run reported for fallback_proposals_to_delete
```

## How to restore from the backup tables

The backups are plain tables, not automatically dropped. To restore a
row:

```sql
INSERT INTO "extracted_proposal"
SELECT * FROM "backup_fallback_proposal_20260924" WHERE "id" = '<id>';

INSERT INTO "evidence"
SELECT * FROM "backup_fallback_evidence_20260924" WHERE "id" = '<id>';
```

Reverting the `test_case` failure state written by the `UPDATE` requires
setting `documentationOutcome`, `documentationSkipReason`,
`documentationOutcomeAt` and `documentationQueuedAt` back by hand — the
script does not back up the pre-update `test_case` rows.

Once satisfied the cleanup is correct, drop the backup tables:

```sql
DROP TABLE "backup_fallback_proposal_20260924";
DROP TABLE "backup_fallback_evidence_20260924";
```
