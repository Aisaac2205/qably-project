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
  so adopted runs have no job; the web app lists them directly under the CI run header, without a group
  heading.
- Reuses a `CiRun` that already exists for the same `(projectId, source, run id)`, which happens when
  the same GitHub run was also reported by a 10.1.0 reporter, or when a `CiRun` spans two batches. The
  existing row is widened (`startedAt` to the earlier value, `lastReportedAt` to the later one) and
  commit fields are filled only when they are `NULL`. An existing value is never overwritten. When
  nothing would change, no update is issued.

`startedAt` and `lastReportedAt` mean different things depending on the origin of the row. For a row
created by live ingestion they are the worker clock at the first and the latest report. For a
backfilled row they are the earliest and the latest `Run.startedAt`. The list is ordered by
`startedAt`, so a backfilled CI run sits at its true chronological position, and the duration shown in
the UI for it is the spread of its suites' start times, not the duration of the workflow.

## Idempotency and failure behavior

A second pass finds only unattributable runs: it creates 0 `CiRun` rows, modifies 0 runs and prints the
same unattributable count as the first pass.

The script does not use a transaction across groups. Each group is a lookup, a create or an update,
and a link. If the process stops between the create and the link, a `CiRun` without runs remains; the
next pass finds it by its unique key, reuses it and links the runs. If live ingestion creates the same
`CiRun` between the lookup and the create, the create fails on the unique constraint and the script
exits with a non-zero code; running it again resolves it.

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
3. Only then run it against the shared database.

## How to verify

```sql
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND "externalId" ~ '^gha-[0-9]+-';
-- expect 0, or only rows ingested after the run started

SELECT count(*) FROM "run" WHERE "ciRunId" IS NOT NULL AND "ciJobKey" IS NULL;
-- expect the Runs linked figure from the output, plus live-linked runs that reported no job
```

In the web app, open the detail of an adopted CI run. Its suites appear directly under the header,
with no group heading of any kind, and no group is named after an unidentified job.

## Rollback

The script writes only `ci_run` rows and `run.ciRunId`. `run.ciRunId` is `ON DELETE SET NULL`, so
deleting `ci_run` rows unlinks their runs. Run either statement inside a transaction, check the
reported row count, then `COMMIT` or `ROLLBACK`.

Remove every `CiRun`, including those created by live ingestion, and clear the job keys so no run is
left with a job and no CI run:

```sql
BEGIN;
UPDATE "run" SET "ciJobKey" = NULL WHERE "ciJobKey" IS NOT NULL;
DELETE FROM "ci_run";
```

Remove only what the script created. The script cannot tell its own rows from live ones, so this
selects rows that have no workflow metadata and no run with a job key. A backfilled `CiRun` that a
10.1.0 reporter later updated has metadata and is kept:

```sql
BEGIN;
DELETE FROM "ci_run" c
  WHERE c."workflowName" IS NULL AND c."runNumber" IS NULL AND c."branch" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "run" r WHERE r."ciRunId" = c.id AND r."ciJobKey" IS NOT NULL);
```

## Verification status

The grouping, merge, batching and idempotency rules are covered by unit tests against an in-memory
port, and the Prisma calls (filters, ordering, the `ciRunId IS NULL` guard on the link) by unit tests
against a mocked client. The script has not been executed against a real database as part of the
change that introduced it, so the first run on a disposable database (see "Recommended order") is also
its first real execution.
