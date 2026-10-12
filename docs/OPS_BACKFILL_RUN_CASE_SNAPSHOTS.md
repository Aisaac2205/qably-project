# Ops: backfill-run-case-snapshots.ts

Owner-run only. Never executed automatically by this codebase or by CI.

## Purpose

Gives the run cases that were recorded before `run_case.catalogSnapshot` existed the catalog content they
most plausibly executed. Those rows have `catalogSnapshot IS NULL` and `testCaseVersionId IS NULL`, so the
run detail reads the **live** catalog case for them: edit or delete the case today and an old run shows the
new content (`docs/SUITES_AND_RUNS.md`, "The catalog content a run executed"). Rows recorded since migration
`20261009120000_add_run_case_catalog_snapshot` already carry a snapshot, written by ingestion, and are never
touched.

The script fills the two columns for the old rows that the data allows it for. It is an **approximation**:
see "The rule" and "What it cannot reconstruct". Every snapshot it writes says so in the row itself, with
`"origin": "backfill"`, so a backfilled snapshot can always be told apart from one that ingestion took from
the catalog as it stood (`"origin": "ingest"`).

## The rule

For every `run_case` with `catalogSnapshot IS NULL` and `testCaseId IS NOT NULL`, take the **latest
`test_case_version` of that test case with `publishedAt <= run.startedAt`**. The latest is the highest
`publishedAt`; two versions published at the same instant are told apart by the higher `version` number.

- When one exists, the script sets `testCaseVersionId = version.id` and

  ```json
  {
    "name": "<version.title>",
    "steps": ["<version.steps>"],
    "expectedResult": "<version.expectedResult>",
    "version": 3,
    "origin": "backfill"
  }
  ```

  This is the "version in force": the last **published** content when the run started. A version published
  at the exact instant the run started counts; one published a millisecond later does not.

- When no version existed when the run started (a draft that had never been approved, or a case whose first
  approval came after the run), the row is left untouched. The script never uses the live `test_case` row
  and never invents content.
- When `testCaseId IS NULL` (the catalog case was deleted), the row is left untouched.
- A row that already has a snapshot is never overwritten, whatever its origin or shape: one written by
  ingestion (`"origin": "ingest"`), one written before the marker existed (no `origin`), and even a malformed
  one. The write itself is guarded by `catalogSnapshot IS NULL`, so a snapshot that live ingestion writes
  after the script read the row also survives.

## What it cannot reconstruct

- **Edits made in place.** `SuiteCasesService.updateCase` changes `test_case` directly, without publishing a
  version. Content edited that way after a publish belongs to no `test_case_version`, so the script cannot
  know it. A run that executed such an edit is given the previous published content. The same holds for a
  case whose draft content was reported and run before it was ever approved: the row is left untouched.
- **The moment a run really executed.** `run.startedAt` is the start time the reporter sent when it sent
  one, and otherwise the time the first report arrived. In the second case a version published between the
  execution and the arrival is chosen although the run did not execute it.
- **Deleted cases.** With `testCaseId IS NULL` there is no case to look a version up for.
- **Anything about runs that were never linked to a case**, and the content of versions that were deleted
  (a version goes away with its test case).

Because the snapshot is labelled, nothing is lost by the approximation: a row the owner later considers wrong
can be returned to "reads the live case" with the rollback below.

## What it does

- Reads `run_case` rows with `catalogSnapshot IS NULL` in `id` order, 500 per batch, using a keyset cursor on
  `id`, together with the `startedAt` of their run. It never holds more than one batch.
- Per batch, reads the versions of the distinct test cases of the batch published at or before the latest
  start in the batch, chooses the version in force **per row** with the same function that the unit tests
  cover (`selectVersionInForce`), and groups the rows that share a version.
- In apply mode, writes each batch in **one transaction**: one `updateMany` per version group, restricted to
  `id IN (...) AND testCaseId = <the group's case> AND catalogSnapshot IS NULL`, writing only
  `testCaseVersionId` and `catalogSnapshot`. A row that changed after the read (a snapshot written by live
  ingestion, or a case unlinked meanwhile) matches nothing and is reported as "Changed since they were
  read". It is not an error: the next run sees the row as it is now.
- Counts, but never modifies, the rows with no version in force, the rows with no linked case, and (with one
  `count` query before the first batch) the rows that already hold a snapshot.
- Logs one line per batch and a summary. It deletes nothing and writes nothing but those two columns.
- **Dry run by default.** Without `--confirm` it performs the same reads and prints what it would do, but
  never writes: the write function is not reached. `--confirm` applies. `--dry-run` is accepted as an
  explicit spelling of the default, and `--dry-run --confirm` together is refused before any connection is
  opened, because the two flags ask for opposite things.

## Idempotency and failure behavior

A second run finds nothing to fill: the rows it filled now hold a snapshot, so they are no longer read, and
the rows it leaves (no version in force, no linked case) are read again and counted again. It reports
`Filled: 0` and the same two "left untouched" counts as the first pass, and changes no byte of `run_case`.
A dry run after an apply says `Would fill: 0`.

A later pass is a no-op unless rows without a snapshot appeared in between. Only an API instance that still
runs the code from before the snapshot migration can produce them (a rolling deploy, a worker that was not
restarted), and a later pass fills those like any other. Approving a catalog case afterwards changes
nothing: the rule looks only at versions published up to the start of each run.

Each batch is one transaction. If the process stops, the batches already committed stay (each is a complete,
valid state) and the rest is picked up by the next run; nothing is half-written. Any database error aborts
the run with exit code 1. A foreign key violation on `testCaseVersionId` is possible only if the catalog case
is deleted in the same instant the batch writes (its versions are deleted with it); the batch rolls back and
a new run finishes the job.

## Pre-checks

1. The migration `20261009120000_add_run_case_catalog_snapshot` is applied to the target database. The
   script reads and writes `run_case.catalogSnapshot` and `run_case.testCaseVersionId`, so it fails with a
   Prisma error on a database without the migration. **Run it after the migration, never before.**
2. Confirm `DATABASE_URL` points at the intended database. The script does not read any `.env` file; it uses
   the `DATABASE_URL` of the shell it is started from. It prints only the database **hostname** before
   reading anything, never the full connection string, credentials or database name, so confirm the full
   value yourself beforehand.
3. Take the counts the script will report:

```sql
SELECT count(*) FROM "run_case" WHERE "catalogSnapshot" IS NOT NULL;
SELECT count(*) FROM "run_case" WHERE "catalogSnapshot" IS NULL;
SELECT count(*) FROM "run_case" WHERE "catalogSnapshot" IS NULL AND "testCaseId" IS NULL;
SELECT count(*) FROM "run_case" WHERE "testCaseVersionId" IS NOT NULL AND "catalogSnapshot" IS NULL;
```

The first is "Already have a snapshot", the second "Run cases without a snapshot", the third "No linked case".
The fourth must be 0: ingestion writes the version link and the snapshot together, and the rollback below
clears both columns of the rows it targets, so a link without a snapshot would be lost by it.

4. The same rule, written in SQL. It is read-only and independent of the script, so its two figures must
   equal "Would fill" and "No version in force" of the dry run:

```sql
SELECT count(*) FILTER (WHERE v."id" IS NOT NULL) AS would_fill,
       count(*) FILTER (WHERE v."id" IS NULL) AS no_version_in_force
  FROM "run_case" rc
  JOIN "run" r ON r."id" = rc."runId"
  LEFT JOIN LATERAL (
    SELECT tv."id" FROM "test_case_version" tv
     WHERE tv."testCaseId" = rc."testCaseId" AND tv."publishedAt" <= r."startedAt"
     ORDER BY tv."publishedAt" DESC, tv."version" DESC
     LIMIT 1
  ) v ON true
 WHERE rc."catalogSnapshot" IS NULL AND rc."testCaseId" IS NOT NULL;
```

No pre-run snapshot of the data is needed. The script only writes rows whose two columns are `NULL`, so
"both `NULL`" is the exact previous state of every row it changes, and the `origin` marker finds those rows
again (see "Rollback").

## How to run

Dry run first. It is the default and writes nothing:

```sh
DATABASE_URL="postgresql://..." \
  pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-run-case-snapshots.ts
```

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://..."
pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-run-case-snapshots.ts
```

Read the dry-run output, compare it with the pre-checks, and only then apply:

```sh
DATABASE_URL="postgresql://..." \
  pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-run-case-snapshots.ts --confirm
```

```powershell
$env:DATABASE_URL = "postgresql://..."
pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-run-case-snapshots.ts --confirm
```

Dry run output (`Mode: dry run`):

```
Target database host: db.example.internal
Mode: dry run, nothing is written
Batch 1: read 500, 480 would be filled (500 scanned)
Batch 2: read 500, 470 would be filled (1000 scanned)
Batch 3: read 208, 205 would be filled (1208 scanned)
Already have a snapshot (left untouched): 3
Run cases without a snapshot: 1208
Would fill: 1155
No version in force when the run started (left untouched): 50
No linked case (left untouched): 3
Dry run: nothing was written. Re-run with --confirm to fill the rows above.
```

Apply output:

```
Target database host: db.example.internal
Mode: apply
Batch 1: read 500, filled 480 (500 scanned)
Batch 2: read 500, filled 470 (1000 scanned)
Batch 3: read 208, filled 205 (1208 scanned)
Already have a snapshot (left untouched): 3
Run cases without a snapshot: 1208
Filled: 1155
No version in force when the run started (left untouched): 50
No linked case (left untouched): 3
Changed since they were read (not written): 0
```

`Already have a snapshot` is counted once, before the first batch, and is not part of `Run cases without a
snapshot`. `Would fill` and `Filled` are the rows a version was in force for. `Filled` is what was actually
written, so `Filled` plus `Changed since they were read` equals the number of rows that were eligible.

Exit codes: 0 when the run completed, 1 when it refused to start (`--dry-run` with `--confirm`, a missing
`DATABASE_URL`) or aborted on an error.

## Recommended order

1. Run it against a disposable copy of the data with the migration applied. Read the counts: a "No version
   in force" figure far above what you expect means the old runs mostly pre-date the first approval of their
   cases. Practice the rollback there as well; "Verification status" says what has been executed already.
2. Take the counts from "Pre-checks" in the shared database and run the **dry run** against it. `Would fill`
   and `No version in force` must equal the figures of the SQL in pre-check 4; `Already have a snapshot` and
   `No linked case` must equal pre-check queries 1 and 3.
3. Run it again with `--confirm` and read the exit code (`echo "exit code: $?"` in a shell,
   `$LASTEXITCODE` in PowerShell). `Filled` must equal the dry run's `Would fill`, unless live ingestion
   wrote in between, in which case the difference is `Changed since they were read`.
4. Run it a third time with `--confirm` and confirm `Filled: 0` and unchanged "left untouched" figures.
5. Run the queries of "How to verify" and open one old run in the web app.

## How to verify

```sql
SELECT count(*) FROM "run_case" WHERE "catalogSnapshot"->>'origin' = 'backfill';
-- expect the "Filled" figure of the apply run (plus the filled figures of earlier passes)

SELECT count(*) FROM "run_case" rc
  JOIN "run" r ON r."id" = rc."runId"
  JOIN "test_case_version" tv ON tv."id" = rc."testCaseVersionId"
 WHERE rc."catalogSnapshot"->>'origin' = 'backfill'
   AND (tv."publishedAt" > r."startedAt" OR (rc."catalogSnapshot"->>'version')::int <> tv."version");
-- expect 0: a backfilled row never points at a version published after its run started,
-- and its snapshot says the same version number as the version it links to

SELECT count(*) FROM "run_case" WHERE "catalogSnapshot" IS NULL AND "testCaseId" IS NOT NULL;
-- expect the "No version in force" figure: the only linked rows still without a snapshot

SELECT count(*) FROM "run_case" WHERE "testCaseVersionId" IS NOT NULL AND "catalogSnapshot" IS NULL;
-- expect 0
```

In the web app, open a run recorded before the migration whose catalog case has been edited since. Its
case shows the name, steps and expected result of the version that was in force when the run started, not
today's content, and the executed version number is that version's.

## Rollback

Everything the script writes is marked, so the rollback is exact and needs no snapshot. It returns the rows
to "reads the live case", which is what they were before the script ran. Run it inside a transaction, check
the row count (it must equal the number of rows the script filled), then `COMMIT` or `ROLLBACK`:

```sql
BEGIN;

UPDATE "run_case" SET "catalogSnapshot" = NULL, "testCaseVersionId" = NULL
 WHERE "catalogSnapshot"->>'origin' = 'backfill';
```

Rows with `"origin": "ingest"` and rows with no `origin` are never matched.

A run that is **re-reported after** the backfill keeps its backfilled snapshot (ingestion reuses the snapshot
a row already holds), and the replacement row carries `"origin": "backfill"` too. The rollback therefore
clears those rows as well, and the next re-report of such a run snapshots the catalog as it stands. That is
the same state the rows had before the backfill.

For a large table, clear the rows in slices of 5000 instead, repeating the statement until it reports
`UPDATE 0` (each execution is its own short transaction):

```sql
UPDATE "run_case" SET "catalogSnapshot" = NULL, "testCaseVersionId" = NULL
 WHERE "id" IN (
   SELECT "id" FROM "run_case"
    WHERE "catalogSnapshot"->>'origin' = 'backfill'
    ORDER BY "id" LIMIT 5000
 );
```

## Locking and volume

- Reads are keyset pages of 500 on the primary key, and one read of at most 500 case ids against
  `test_case_version` (indexed on `testCaseId`) per batch. The first read scans `run_case` for
  `catalogSnapshot IS NULL`, which has no index; it is the only full pass and `count(*)` is a sequential
  scan too.
- Writes are `UPDATE`s of at most 500 rows per transaction, taking row-level locks only. They do not block
  readers. A concurrent ingestion that re-reports one of the rows being updated waits for the end of that
  batch, which is a fraction of a second. Each updated row also takes a `FOR KEY SHARE` lock on its version
  row, so deleting a catalog case (which deletes its versions) waits for the batch too.
- The update touches the indexed column `testCaseVersionId`, so the rows are not heap-only updates and
  `run_case_testCaseVersionId_idx` grows by one entry per filled row. The table gets one new row version per
  filled row, the cost of any update.
- Run it in a quiet window if the table is large (hundreds of thousands of rows). Nothing in it needs
  downtime: a run that is being ingested is simply not touched, because it already holds a snapshot.

## Verification status

The version selection (the `publishedAt <= startedAt` boundary, a later version ignored, several versions,
the same-instant tie), the snapshot shape, the dry run, the keyset batching across batch boundaries, the
grouping per version, idempotency and the rows that change between the read and the write are covered by
unit tests against an in-memory port; the Prisma calls (filters, ordering, the `catalogSnapshot IS NULL` and
`testCaseId` guards on the write, the single transaction per batch) by unit tests against a mocked client.

Beyond that, the real script code (the Prisma port, the library and the CLI, over the generated Prisma
client) was run against an in-process PostgreSQL (PGlite) with every migration applied: a dry run that left
the table byte-identical, an apply, a second apply that changed nothing, a rollback that restored the table
byte for byte, a re-apply that reproduced the first result byte for byte, the read-back through
`parseCatalogSnapshot`, and a race with live ingestion. The SQL blocks of this document were executed in that
run. That run is a throwaway check and is not part of the repository's test suite. It does not cover
concurrent writers other than the one simulated race, the size of a production table, or the behaviour of
the Railway connection (`@prisma/adapter-pg` over the network), which the script shares with
`backfill-ci-runs.ts`.
