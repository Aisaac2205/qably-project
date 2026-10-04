# Ops: backfill-ci-runs.ts

Owner-run only. Never executed automatically by this codebase or by CI.

## Purpose

Links runs that were ingested before the `ci_run` table existed, or by a reporter older than 10.1.0,
to a `CiRun` row. Those runs have `run.ciRunId = NULL`, so they appear only under the Manual tab of the
runs page and never under a CI run in the Actions tab.

The reporter has always embedded the GitHub run id in `Run.externalId`, in the form
`gha-{GITHUB_RUN_ID}-{job}-{file}-{hash}` (with a trailing `-p{n}` when a file was split). The script
promotes that id to a `CiRun` row and links the runs that carry it. It derives nothing else from the
id: `workflowName`, `runNumber`, `branch`, `actor` and the other `ci*` columns were never stored on
`Run`, so a backfilled `CiRun` has them empty until a reporter at 10.1.0 or later reports the same
GitHub run.

## What it does

- Reads `run` rows with `ciRunId IS NULL` in `id` order, 500 per batch, using a keyset cursor on `id`.
  It never holds more than one batch, and never writes more than one batch of run ids in one statement.
- Attributes a run when `externalId` matches `^gha-(\d+)-`. Anything else is **unattributable**:
  `gha-local-job-...` (a local reporter run), `gha-abc-...`, a `null` `externalId` (manual runs and runs
  posted by `POST /runs/ingest` with its own ids). Unattributable runs are counted and never modified.
- Groups attributable runs by `(projectId, source, run id)` and creates one `CiRun` per group with the
  project, organization and source of the runs. `startedAt` is the earliest `Run.startedAt` of the
  group and `lastReportedAt` the latest. `commitSha`, `commitMessage` and `commitAuthor` are taken from
  the runs (the first non-null value of each field).
- Links the runs with `updateMany` restricted to `ciRunId IS NULL` and writing only `ciRunId`. A run
  that live ingestion linked after the batch was read is left as it is. `ciJobKey` is never written,
  so adopted runs have no job; the web app lists their failing suites directly under the CI run header,
  without a group heading, and puts the others behind a "Show N suites without failures" button.
- Reuses a `CiRun` that already exists for the same `(projectId, source, run id)`, which happens when
  the same GitHub run was also reported by a 10.1.0 reporter, or when a `CiRun` spans two batches. The
  existing row is widened (`startedAt` to the earlier value, `lastReportedAt` to the later one) and
  commit fields are filled only when they are `NULL`. An existing value is never overwritten. When
  nothing would change, no update is issued.
- Applies that update only if the row still holds the values the script read: the write is an
  `updateMany` filtered on `id`, `startedAt`, `lastReportedAt` and the three commit fields. If live
  ingestion changed the row in between, no row matches, the script reads it again, recomputes the merge
  from the fresh values and retries, up to 5 attempts. A value written by live ingestion after the read
  is therefore never replaced by an older one.

`startedAt` and `lastReportedAt` mean different things depending on the origin of the row. For a row
created by live ingestion they are the clock of the process that handled the first and the latest
report. For a backfilled row they are the earliest and the latest `Run.startedAt`. When the script
merges older runs into a row that live ingestion created, it lowers that row's `startedAt` to the
earliest of them, which moves the row down the list. The list is ordered by `startedAt`, so a
backfilled CI run sits at its true chronological position, and the duration shown in the UI for it is
the spread of its suites' start times, not the duration of the workflow.

## Idempotency and failure behavior

When nothing is ingested between two passes, the second one finds only unattributable runs: it creates
0 `CiRun` rows, modifies 0 runs and prints the same unattributable count as the first pass.

A later pass is not always a no-op. A reporter older than 10.1.0 (a vendored or pinned copy of
`qably-report.mjs`) keeps producing runs whose `externalId` is attributable and whose `ciRunId` is
`NULL`, and every pass links the ones that arrived since the previous one. Runs posted with `curl`, as
in the public CI documentation, carry the bare GitHub run id as `externalId`, which does not match
`^gha-(\d+)-`: they are unattributable, stay unlinked on every pass and keep appearing under the Manual
tab.

The script does not use a transaction across groups. Each group is a lookup, a create or an update,
and a link. If the process stops between the create and the link, a `CiRun` without runs remains; the
next pass finds it by its unique key, reuses it and links the runs. If live ingestion creates the same
`CiRun` between the lookup and the create, the create fails on the unique constraint (`P2002`); the
script catches that, reads the row again and merges into it as into any existing `CiRun`. Any other
error on the create aborts the run. A group that is still not resolved after 5 attempts, because live
ingestion keeps changing its `CiRun`, aborts the run with a non-zero code and an error that names the
`CiRun`; none of its runs are linked, and running the script again resolves it.

## Pre-checks

1. The migration `20261003161840_add_ci_run` is applied to the target database.
2. Confirm `DATABASE_URL` points at the intended database. The script prints only the database
   **hostname** before reading anything, never the full connection string, credentials or database
   name, so confirm the full value yourself beforehand.
3. Take a count of what the script can attribute:

```sql
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND "externalId" ~ '^gha-[0-9]+-';
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND ("externalId" IS NULL OR "externalId" !~ '^gha-[0-9]+-');
```

## Pre-run snapshot

Take it immediately before the run, in the database the script will write to. It is what makes the
rollback exact: it records which `CiRun` rows existed, their `startedAt`, `lastReportedAt` and commit
fields, and which runs were already linked. Without it the rollback is approximate (see "Rollback
without a snapshot").

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

CREATE SCHEMA backfill_snapshot;

CREATE TABLE backfill_snapshot.ci_run AS
  SELECT "id", "startedAt", "lastReportedAt", "commitSha", "commitMessage", "commitAuthor"
  FROM "ci_run";

CREATE TABLE backfill_snapshot.linked_run AS
  SELECT "id" FROM "run" WHERE "ciRunId" IS NOT NULL;

SELECT (SELECT count(*) FROM backfill_snapshot.ci_run) AS ci_runs,
       (SELECT count(*) FROM backfill_snapshot.linked_run) AS linked_runs;

COMMIT;
```

The tables live in their own schema, outside the `public` schema that Prisma manages. Keep them until
the result of the run is accepted, then remove them with `DROP SCHEMA backfill_snapshot CASCADE;`.

## How to run

```sh
DATABASE_URL="postgresql://..." \
  pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-ci-runs.ts --confirm
```

Omitting `--confirm` always fails before the database is opened: the script prints the refusal,
exits with code 1 and no connection is created. This is intentional, so a bare invocation never
writes anything by accident.

Output:

```
Target database host: db.example.internal
Scanned: 4120
Unattributable (left untouched): 310
CiRuns created: 295
CiRuns updated: 2
Runs linked: 3810
```

`Scanned` is every run read with `ciRunId IS NULL`. The unattributable runs stay unlinked and keep
appearing under the Manual tab.

## Recommended order

1. Run it against a disposable database with realistic data and the migration applied, and read the
   unattributable count. A count far above the number of manual and local runs means the id format
   differs from what the pattern expects.
2. Run it a second time on the same database and confirm `CiRuns created`, `CiRuns updated` and
   `Runs linked` are all 0 and the unattributable count is unchanged.
3. Only then take the pre-run snapshot and run it against the shared database. Practice the rollback
   on the disposable database first: its statements have not been executed against a real database.

## How to verify

```sql
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND "externalId" ~ '^gha-[0-9]+-';
-- expect 0, or only rows ingested after the run started

SELECT count(*) FROM "run" WHERE "ciRunId" IS NOT NULL AND "ciJobKey" IS NULL;
-- expect the Runs linked figure from the output, plus live-linked runs that reported no job
```

In the web app, open the detail of an adopted CI run. Its failing suites, if any, appear directly under
the header and the suites without failures sit behind a "Show N suites without failures" button. There
is no group heading of any kind, and no group is named after an unidentified job.

## Rollback

The script writes two things: `ci_run` rows (it creates them, and it updates `startedAt`,
`lastReportedAt` and the commit fields of ones that already exist) and `run.ciRunId`. It never writes
`run.ciJobKey`. `run.ciRunId` is `ON DELETE SET NULL`, so deleting a `ci_run` row unlinks its runs.
Run every block below inside a transaction, check the reported row counts, then `COMMIT` or `ROLLBACK`.

### Rollback with the snapshot

This reverses exactly what the script changed, using the tables from "Pre-run snapshot":

```sql
BEGIN;

UPDATE "run" r SET "ciRunId" = NULL
  WHERE r."ciRunId" IS NOT NULL
    AND r."ciJobKey" IS NULL
    AND r."externalId" ~ '^gha-[0-9]+-'
    AND NOT EXISTS (SELECT 1 FROM backfill_snapshot.linked_run s WHERE s.id = r.id);

DELETE FROM "ci_run" c
  WHERE NOT EXISTS (SELECT 1 FROM backfill_snapshot.ci_run s WHERE s.id = c.id)
    AND NOT EXISTS (SELECT 1 FROM "run" r WHERE r."ciRunId" = c.id);

UPDATE "ci_run" c SET
    "startedAt" = s."startedAt",
    "lastReportedAt" = s."lastReportedAt",
    "commitSha" = s."commitSha",
    "commitMessage" = s."commitMessage",
    "commitAuthor" = s."commitAuthor"
  FROM backfill_snapshot.ci_run s
  WHERE s.id = c.id
    AND (c."startedAt", c."lastReportedAt", c."commitSha", c."commitMessage", c."commitAuthor")
      IS DISTINCT FROM
      (s."startedAt", s."lastReportedAt", s."commitSha", s."commitMessage", s."commitAuthor");
```

1. The first statement unlinks the runs that were not linked in the snapshot. The snapshot is the
   criterion. `ciJobKey IS NULL` and the `externalId` pattern only narrow it, because the script links
   nothing else: it never writes a job key and attributes only ids that match the pattern. Neither of
   them identifies the script's links on its own, since live ingestion also links runs without a job
   key when a report sends `ciRunExternalId` and no `ciJobKey`.
2. The second statement deletes the `CiRun` rows that are not in the snapshot and have no run left. These
   are the rows the script created. A row that live ingestion created after the snapshot and that still
   holds runs with a job key is kept.
3. The third statement restores `startedAt`, `lastReportedAt` and the commit fields of the `CiRun` rows
   that already existed. Row counts to expect: the first statement about the `Runs linked` figure of the
   script output, the second about `CiRuns created`, the third at most `CiRuns updated`.

Limits of the rollback with the snapshot. Anything live ingestion wrote after the snapshot is
indistinguishable from the script's work in the same rows. A run that live ingestion linked after the
snapshot without a job key is unlinked by the first statement, and the third statement also reverts
the `lastReportedAt` and commit fields that a live report wrote to a `CiRun` after the snapshot. If
reports kept arriving between the snapshot and the rollback, drop `lastReportedAt` and the three commit
fields from the third statement and restore `startedAt` only: ingestion never writes it. When the
result is accepted, remove the snapshot with `DROP SCHEMA backfill_snapshot CASCADE;`.

### Rollback without a snapshot

Without a snapshot the script's changes cannot be separated from live ones, and part of them cannot be
reverted at all:

- Which runs the script linked is not recorded. `ciJobKey IS NULL` does not identify them: live
  ingestion also links runs with no job key.
- Which `CiRun` rows the script created is not recorded.
- The previous `startedAt`, `lastReportedAt` and commit fields of a `CiRun` that already existed are
  not recorded, so a widened `startedAt`, a raised `lastReportedAt` and filled commit fields cannot be
  restored.

Two statements remain, and both are approximations.

Remove every `CiRun`, including those created by live ingestion, and clear every job key, including
those written by live ingestion, so that no run is left with a job and no CI run. The next report of a
workflow run creates its `CiRun` again and links only the suites it reports:

```sql
BEGIN;
UPDATE "run" SET "ciJobKey" = NULL WHERE "ciJobKey" IS NOT NULL;
DELETE FROM "ci_run";
```

Remove only the `CiRun` rows that look like the script's: no workflow metadata and no run with a job
key. A backfilled `CiRun` that a 10.1.0 reporter later updated has metadata and is kept:

```sql
BEGIN;
DELETE FROM "ci_run" c
  WHERE c."workflowName" IS NULL AND c."runNumber" IS NULL AND c."branch" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "run" r WHERE r."ciRunId" = c.id AND r."ciJobKey" IS NOT NULL);
```

This second statement does not unlink the runs the script linked into a `CiRun` that already existed,
does not revert the widened `startedAt`, the raised `lastReportedAt` or the filled commit fields of
those rows, and can delete a live `CiRun` that has no metadata and no run with a job key, for example
one created by a report that sent only `ciRunExternalId`.

## Verification status

The grouping, merge, batching and idempotency rules are covered by unit tests against an in-memory
port, and the Prisma calls (filters, ordering, the `ciRunId IS NULL` guard on the link) by unit tests
against a mocked client. The script has not been executed against a real database as part of the
change that introduced it, so the first run on a disposable database (see "Recommended order") is also
its first real execution. The concurrent-write guard (the conditional update and the retry after a
unique violation) is proven against an in-memory port and a mocked client, not against concurrent
writers on a real database. The snapshot and rollback SQL have not been executed either.
