# Ops: reclassify-pending-proposals.ts

Owner-run only. Never executed automatically by this codebase or by CI.

## Purpose

Backfills the persisted classification columns (`duplicateKind`,
`matchedCaseId`, `duplicateScore`, `duplicateReasons`, `classifiedAt`) on
`extracted_proposal` for every proposal that was created before the
`ProposalClassificationModule` reclassify triggers existed. Without this
backfill, those older `in_review` proposals keep `duplicateKind = NULL`
until something else touches their suite (a new proposal, a case
create/rename, or a run ingest that creates a case) — `GET
/review/inbox` still renders them correctly as classification `kind:
'none'`, but `duplicatesOnly` cannot find a real duplicate among them
until they are reclassified at least once.

The script does not classify anything itself. It finds every suite that
currently has at least one `in_review` proposal and enqueues one
`reclassify-suite` BullMQ job per suite, using the same
`ProposalReclassifier` deduplication id (`buildJobId('reclassify',
[suiteId])`) and `keepLastIfActive` setting the rest of the app uses. A
suite already queued (waiting) for that id is a no-op; a suite whose job
is currently running gets exactly one more run scheduled after it
finishes, so re-running this script never loses or duplicates work, and
a suite whose previous job failed is never blocked — the deduplication
key clears on both completion and failure.

## Pre-checks

1. Confirm `DATABASE_URL` points at the intended database, and `REDIS_URL`
   points at the intended queue. The script prints only the database
   **hostname** before enqueuing anything — never the full connection
   string, credentials, or database name — so confirm the full value
   yourself beforehand if you need to double-check it.
2. The BullMQ workers for `PROPOSAL_CLASSIFICATION_QUEUE` must already be
   running (the normal API deployment runs them) — this script only
   enqueues jobs, it never classifies proposals in-process.

## How to run

```sh
DATABASE_URL="postgresql://..." REDIS_URL="redis://..." \
  pnpm --filter @qably/api exec tsx scripts/reclassify-pending-proposals.ts --confirm
```

Omitting `--confirm` always fails loudly before touching the database or
the queue — this is intentional, so a bare invocation (for example, while
copy-pasting a command) never enqueues anything by accident.

## How to verify

After the workers have had time to drain the queue:

```sql
SELECT count(*) FROM "extracted_proposal"
  WHERE status = 'in_review' AND "classifiedAt" IS NULL;
-- expect 0, or only rows created after this run started
```

## Local testing

This script was verified against the disposable local bench Postgres
(`qably-bench-pg`, the same container `scripts/bench/review-inbox-bench.ts`
uses) — never against the shared Railway database. Point `DATABASE_URL`
at that local container and a local Redis to dry-run it yourself:

```sh
DATABASE_URL="postgresql://bench:bench@localhost:55432/qably_bench" \
  REDIS_URL="redis://localhost:6379" \
  pnpm --filter @qably/api exec tsx scripts/reclassify-pending-proposals.ts --confirm
```
