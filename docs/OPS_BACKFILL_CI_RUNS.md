# Ops: backfill-ci-runs.ts

Owner-run only. Never executed automatically by this codebase or by CI.

## Purpose

Links runs that were ingested before the `ci_run` table existed, or by a reporter older than 10.1.0,
to a `CiRun` row, and gives the runs it can the `ciJobKey` of the job that reported them. Those runs
have `run.ciRunId = NULL`, so they never appear under a CI run in the Actions tab. The Manual tab lists only
the runs a person started, so they are not there either: they stay reachable by their direct link and from
the suites.

The reporter has always embedded the GitHub run id and the job in `Run.externalId`, in the form
`gha-{GITHUB_RUN_ID}-{job}-{file}-{hash}` (with a trailing `-p{n}` when a file was split). The script
promotes that id to a `CiRun` row, links the runs that carry it and recovers the job from the same id
against the job keys the project already uses. It derives nothing else from the id: `workflowName`,
`runNumber`, `branch`, `actor` and the other `ci*` columns were never stored on `Run`, so a backfilled
`CiRun` has them empty until a reporter at 10.1.0 or later reports the same GitHub run.

Runs that a reporter older than 10.1.0 sends from now on are linked by ingestion itself, from the same
id (`docs/RUN_INGESTION.md`, "Linking from the external id"). The script exists for the history that
arrived before that.

## What it does

- Reads `run` rows with `ciRunId IS NULL` in `id` order, 500 per batch, using a keyset cursor on `id`.
  It never holds more than one batch, and never writes more than one batch of run ids in one statement.
- Attributes a run when `externalId` matches `^gha-(\d{1,20})-`, using the same `parseCiRunExternalId` as
  ingestion. Anything else is **unattributable**:
  `gha-local-job-...` (a local reporter run), `gha-abc-...`, a `null` `externalId` (manual runs and runs
  posted by `POST /runs/ingest` with its own ids). Unattributable runs are counted and never modified.
- Groups attributable runs by `(projectId, source, run id)` and creates one `CiRun` per group with the
  project, organization and source of the runs. `startedAt` is the earliest `Run.startedAt` of the
  group and `lastReportedAt` the latest. `commitSha`, `commitMessage` and `commitAuthor` are taken from
  the runs (the first non-null value of each field).
- Links the runs with `updateMany` restricted to `ciRunId IS NULL` and writing only `ciRunId`. A run
  that live ingestion linked after the batch was read is left as it is.
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
- Skips a group that is still not resolved after those 5 attempts, because live ingestion keeps changing
  its `CiRun`. A group is the runs of one GitHub run read in one batch, so a GitHub run whose runs
  straddle two batches can be skipped in one and linked in the next. The runs of the group in the batch
  that skipped it are not linked, the script logs the skip as it happens, carries on with the next group
  and lists the GitHub run external ids (with the project id) in the summary. It exits with code 2 so
  that a skip cannot be mistaken for a clean run. Running the script again links the runs that were left.
- Recovers the job key in a second phase, after every batch of unlinked runs was processed. It reads the
  runs with `ciRunId IS NOT NULL`, `ciJobKey IS NULL` and `externalId LIKE 'gha-%'` in `id` order, 500
  per batch with a keyset cursor, and resolves each one with `resolveCiJobKey` against the job keys of
  its project: every distinct non-null `Run.ciJobKey` of the project, read once per project in an
  execution. It writes with `updateMany` restricted to `ciJobKey IS NULL AND ciRunId IS NOT NULL`, one
  statement per job key per batch, so it never overwrites a key and never gives a key to a run that is
  not linked. This phase covers the runs the script just linked and also the runs linked earlier
  without a key, such as the ones a previous pass linked before this phase existed, in `CiRun` rows
  that the first phase no longer touches.
- Never invents a job. `resolveCiJobKey` accepts a job key only when the project already uses it and
  the id starts with `gha-{run id}-{key}-`, trying the key as written and its slug, and the longest key
  wins (`build-web` over `build`). The id is never split on hyphens, because the job and the file slug
  both contain them and a split would be a guess (`docs/RUN_INGESTION.md`, "Job key"). A run whose id
  matches no known key, or ties between two keys, keeps `ciJobKey IS NULL` and is counted in "Linked
  runs left without a job key". The web app lists such a run's failing suites directly under the CI run
  header, without a group heading, and puts the others behind a "Show N suites without failures"
  button.
- Attributes a job whose key extends a known key to the shorter key. With `web` known and runs of a job
  `web-e2e` that has never been reported with a key, the ids `gha-900-web-e2e-junit-xml-...` start with
  `gha-900-web-` and the script gives those runs `ciJobKey = web`, exactly as ingestion does for a first
  report of a legacy reporter (`docs/RUN_INGESTION.md`, "A new job whose key extends a known key"). The
  id cannot tell the two jobs apart. The script only fills runs whose `ciJobKey IS NULL`, so it never
  corrects a key it set, or one that ingestion set; run the pre-check "Job keys that extend one
  another" before the script.

The keys come from the project's own data, so the script can set none for a project that has no run
with a `ciJobKey` yet, which is the case until a reporter at 10.1.0 or later has reported once. Run the
workflow once, then the script.

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

Job key recovery is idempotent in the same way: a second pass sets 0 job keys and reports the same
"Linked runs left without a job key", unless a job key that the project did not use before has appeared
in between.

A later pass is not always a no-op. A reporter older than 10.1.0 (a vendored or pinned copy of
`qably-report.mjs`) produced runs whose `externalId` is attributable and whose `ciRunId` is `NULL`
until ingestion started linking them from the id; every pass links the ones that arrived before that.
Runs posted with `curl` carry whatever `externalId` the command sets. The `curl` step of the public CI
guide builds `gha-<run id>-<job>`, which matches `^gha-(\d{1,20})-` and is attributable. A run whose
`externalId` is a bare GitHub run id, or any other string that does not match, is unattributable: it stays
unlinked on every pass and stays out of both tabs, reachable by its direct link and from the suites.

The script does not use a transaction across groups. Each group is a lookup, a create or an update,
and a link. If the process stops between the create and the link, a `CiRun` without runs remains; the
next pass finds it by its unique key, reuses it and links the runs. If live ingestion creates the same
`CiRun` between the lookup and the create, the create fails on the unique constraint (`P2002`); the
script catches that, reads the row again and merges into it as into any existing `CiRun`. Any other
error on the create aborts the run with exit code 1. A group that is still not resolved after 5
attempts, because live ingestion keeps changing its `CiRun`, does not abort it: it is skipped, its runs
in that batch are not linked, the run ends with exit code 2 and the summary names the GitHub run
external id and the project. Running the script again links the runs that were left.

## Pre-checks

1. The migration `20261003161840_add_ci_run` is applied to the target database.
2. Confirm `DATABASE_URL` points at the intended database. The script prints only the database
   **hostname** before reading anything, never the full connection string, credentials or database
   name, so confirm the full value yourself beforehand.
3. Take a count of what the script can attribute:

```sql
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND "externalId" ~ '^gha-[0-9]{1,20}-';
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND ("externalId" IS NULL OR "externalId" !~ '^gha-[0-9]{1,20}-');
SELECT count(*) FROM "run" WHERE "ciRunId" IS NOT NULL AND "ciJobKey" IS NULL AND "externalId" LIKE 'gha-%';
```

The first is the number of runs it can link, the second the unattributable figure it will report, the
third the number of already linked runs whose job key it will try to recover. Then list the job keys
the script will resolve against, per project:

```sql
SELECT "projectId", "ciJobKey", count(*) FROM "run"
  WHERE "ciJobKey" IS NOT NULL GROUP BY "projectId", "ciJobKey" ORDER BY "projectId", count(*) DESC;
```

A project missing from this list gets no job key from the script. When one key is a prefix of another
(`build` and `build-web`), the longest match wins, so a run of the job `build` that reports a file named
`web-junit.xml` is attributed to `build-web`: the id carries nothing that tells the two apart.

4. Job keys that extend one another. Run this read-only query before the script. It lists, per project,
   every pair of distinct known keys where the longer one starts with the shorter one followed by `-`,
   comparing the keys as written and through the slug the reporter puts in the id:

```sql
WITH keys AS (
  SELECT "projectId", "ciJobKey" AS key,
         COALESCE(
           NULLIF(trim(both '-' from regexp_replace(lower(btrim("ciJobKey")), '[^a-z0-9]+', '-', 'g')), ''),
           'report'
         ) AS slug,
         count(*) AS runs
    FROM "run"
   WHERE "ciJobKey" IS NOT NULL
   GROUP BY "projectId", "ciJobKey"
)
SELECT shorter."projectId",
       shorter.key AS shorter_key, shorter.runs AS shorter_runs,
       longer.key AS longer_key, longer.runs AS longer_runs
  FROM keys shorter
  JOIN keys longer
    ON longer."projectId" = shorter."projectId"
   AND longer.key <> shorter.key
   AND (
        starts_with(longer.key, shorter.key || '-')
     OR starts_with(longer.key, shorter.slug || '-')
     OR starts_with(longer.slug, shorter.key || '-')
     OR starts_with(longer.slug, shorter.slug || '-')
   )
 ORDER BY shorter."projectId", shorter.key, longer.key;
```

An empty result means that no two known keys of a project can be mistaken for each other. A row is a
pair the script resolves by the longest match, so a run of the shorter job whose file name begins with
the rest of the longer key goes to the longer key. This query cannot show the other case: a job whose key
extends a known key and that has no run with a key yet. Its runs are given the shorter key, and the
script cannot correct them afterwards. Look for it by hand: list the names of the jobs in the workflows
of the project and compare them with the keys of the "Job keys" query above. If a job extends a known
key and has never reported a key, run the workflow once with a reporter at 10.1.0 or later before the
script, so that the key is known.

## Pre-run snapshot

Take it immediately before the run, in the database the script will write to. It is what makes the
rollback exact: it records which `CiRun` rows existed, their `startedAt`, `lastReportedAt` and commit
fields, and the `ciRunId` and `ciJobKey` of every run the script is able to write. Without it the
rollback is approximate (see "Rollback without a snapshot").

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

CREATE SCHEMA backfill_snapshot;

CREATE TABLE backfill_snapshot.ci_run AS
  SELECT "id", "startedAt", "lastReportedAt", "commitSha", "commitMessage", "commitAuthor"
  FROM "ci_run";

CREATE TABLE backfill_snapshot.run_link AS
  SELECT "id", "ciRunId", "ciJobKey" FROM "run"
  WHERE "externalId" LIKE 'gha-%' AND ("ciRunId" IS NULL OR "ciJobKey" IS NULL);

SELECT (SELECT count(*) FROM backfill_snapshot.ci_run) AS ci_runs,
       (SELECT count(*) FROM backfill_snapshot.run_link) AS candidate_runs;

COMMIT;
```

`run_link` holds every run whose `ciRunId` or `ciJobKey` the script can write, and only those. The
script links a run only when it has no `ciRunId` and its `externalId` matches `^gha-(\d{1,20})-`, and it
sets a `ciJobKey` only on a linked run that has none and whose `externalId` starts with `gha-`. Both
conditions are inside the `WHERE` above, and the values in the table are what the rollback restores.
It replaces the `linked_run` table of earlier versions of this document, which could not say which
`ciJobKey` values the script had written.

The tables live in their own schema, outside the `public` schema that Prisma manages. Keep them until
the result of the run is accepted, then remove them with `DROP SCHEMA backfill_snapshot CASCADE;`.

`CREATE SCHEMA` needs the `CREATE` privilege on the database. If the role you connect with does not
have it, the statement fails with a permission error and the transaction creates nothing: run the
snapshot with a role that has the privilege. The script itself creates no schema and needs no such
privilege.

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
Job keys set: 3790
Linked runs left without a job key: 20
Skipped groups: 0
```

`Scanned` is every run read with `ciRunId IS NULL`. The unattributable runs stay unlinked and stay out of
both tabs, reachable by their direct link and from the suites. `Job keys set` counts every run that received a `ciJobKey`, linked in
this pass or earlier. `Linked runs left without a job key` counts the linked runs with an `externalId`
that starts with `gha-` that no known job key matched; it is not an error.

Exit codes: 0 when the run completed with no skipped group, 1 when it refused to start or aborted on an
error, 2 when it completed but skipped at least one group. A skip is logged when it happens and listed
at the end:

```
Skipped github_actions GitHub run 9120334455 of project cmg1abc: concurrent ingestion changed its CiRun in 5 consecutive attempts, so the runs of that group in that batch were not linked.
...
Skipped groups: 1
  github_actions 9120334455 (project cmg1abc)
The runs of these groups in the batch that skipped them were not linked. Run the script again to link them.
```

The identifier printed is the GitHub run external id of the group, not the id of a `CiRun` row. A skip
is per batch: it leaves the runs of that group in that batch unlinked and without a job key, while the
runs of the same GitHub run that were read in another batch can already be linked. Run the script again,
in a quieter moment if the same group is skipped twice.

## Recommended order

1. Run it against a disposable database with realistic data and the migration applied, and read the
   unattributable count. A count far above the number of manual and local runs means the id format
   differs from what the pattern expects. The database must also contain at least one `CiRun` that
   already exists and that the script has to widen or fill: its `startedAt` later than the earliest
   unlinked run of the same GitHub run, its `lastReportedAt` earlier than the latest one, or a `NULL`
   commit field that one of those runs carries. Create it with a 10.1.0 reporter or by hand. That is the
   only way the compare-and-set update runs before the shared database: when every group creates its
   `CiRun`, no update is issued and `CiRuns updated` stays 0. No automated test runs the equality on the
   values it read against a real Postgres, so expect `CiRuns updated` to be above 0 on this pass and check the
   widened row by hand. For the job key, the database needs at least one run with a `ciJobKey` in each
   project, so that the project has a key to resolve against, and at least one run of a job that has
   none, so that `Linked runs left without a job key` is above 0 once.
2. Take the counts from "Pre-checks", then run it:

   ```sh
   DATABASE_URL="postgresql://...disposable..." \
     pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-ci-runs.ts --confirm
   echo "exit code: $?"
   ```

   Compare the output with the counts: `Runs linked` equals the first count, `Unattributable` the
   second, and `Job keys set` plus `Linked runs left without a job key` equals the third count plus
   `Runs linked`. Read the exit code: 0 expected, 2 means a group was skipped.
3. Run it a second time on the same database and confirm `CiRuns created`, `CiRuns updated`,
   `Runs linked` and `Job keys set` are all 0, the unattributable count and `Linked runs left without a
   job key` are unchanged and the exit code is 0.
4. Practice the rollback on the disposable database: no automated test executes its statements. Take
   the snapshot before step 2 for that, run the rollback after it and confirm the
   counts of "Pre-checks" are back.
5. Only then take the pre-run snapshot in the shared database and run the same command against it with
   its `DATABASE_URL`:

   ```sh
   DATABASE_URL="postgresql://...shared..." \
     pnpm --filter @qably/api exec ts-node --project tsconfig.json scripts/backfill-ci-runs.ts --confirm
   echo "exit code: $?"
   ```

   Then run the queries of "How to verify".

## How to verify

```sql
SELECT count(*) FROM "run" WHERE "ciRunId" IS NULL AND "externalId" ~ '^gha-[0-9]{1,20}-';
-- expect 0, or only rows ingested after the run started

SELECT count(*) FROM "run" WHERE "ciRunId" IS NOT NULL AND "ciJobKey" IS NULL AND "externalId" LIKE 'gha-%';
-- expect the "Linked runs left without a job key" figure from the output, plus live-linked runs that
-- reported no job

SELECT "projectId", "ciJobKey", count(*) FROM "run"
  WHERE "ciJobKey" IS NOT NULL GROUP BY "projectId", "ciJobKey" ORDER BY "projectId", count(*) DESC;
-- expect the same keys as before the run, with higher counts and no key that was not in the list

SELECT count(*) FROM "run" WHERE "ciJobKey" IS NOT NULL AND "ciRunId" IS NULL;
-- expect 0: a job key never exists without its CiRun
```

In the web app, open the detail of an adopted CI run. Its suites are grouped under the job that
reported them, as in a CI run that a 10.1.0 reporter created. A suite that no known key matched appears
directly under the header when it has failures, or behind the "Show N suites without failures"
button, with no group heading, and no group is named after an unidentified job.

## Rollback

The script writes three things: `ci_run` rows (it creates them, and it updates `startedAt`,
`lastReportedAt` and the commit fields of ones that already exist), `run.ciRunId` and `run.ciJobKey`.
`run.ciRunId` is `ON DELETE SET NULL`, so deleting a `ci_run` row unlinks its runs but leaves their
`ciJobKey`, which is why the statements below clear the job key in the same statement that unlinks.
Run every block below inside a transaction, check the reported row counts, then `COMMIT` or `ROLLBACK`.

### Rollback with the snapshot

This reverses exactly what the script changed, using the tables from "Pre-run snapshot".

Pause ingestion first, or run it in a quiet window in which no workflow reports. Live ingestion resolves
the `CiRun` before it writes the run, in two separate steps: the row is created, and the run that
points at it is inserted afterwards in a transaction. The second statement below deletes every `CiRun`
that is not in the snapshot and has no run. A `CiRun` that live ingestion created a moment before its
run was inserted matches that condition, so the delete removes it and the run insert then fails its
foreign key check on `ciRunId`. A queued report is retried by the queue (3 attempts, exponential backoff
starting at 1 s), which creates the `CiRun` again; a request to `POST /runs/ingest` fails and the client
has to send it again.

```sql
BEGIN;

UPDATE "run" r SET "ciRunId" = s."ciRunId", "ciJobKey" = s."ciJobKey"
  FROM backfill_snapshot.run_link s
  WHERE s.id = r.id
    AND (r."ciRunId", r."ciJobKey") IS DISTINCT FROM (s."ciRunId", s."ciJobKey");

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

1. The first statement puts back the `ciRunId` and the `ciJobKey` that every run in `run_link` had when
   the snapshot was taken. `run_link` holds the runs the script can write and nothing else, so the
   statement reverses the links the script made (a `ciRunId` back to `NULL`) and the job keys it set,
   on runs it linked and on runs that were already linked (a `ciJobKey` back to `NULL`), and leaves
   every run that is not in the table alone. A run that ingestion created after the snapshot, linked
   and with its job key, is not in it.
2. The second statement deletes the `CiRun` rows that are not in the snapshot and have no run left. These
   are the rows the script created. A row that live ingestion created after the snapshot and that still
   holds runs is kept.
3. The third statement restores `startedAt`, `lastReportedAt` and the commit fields of the `CiRun` rows
   that already existed. Row counts to expect: the first statement at least the `Runs linked` figure of
   the script output and at most `Runs linked` plus `Job keys set`, the second about `CiRuns created`,
   the third at most `CiRuns updated`.

Limits of the rollback with the snapshot. Anything live ingestion wrote after the snapshot to a row
that the snapshot covers is indistinguishable from the script's work in that row. A run in `run_link`
that ingestion linked or keyed again after the snapshot, which only happens when a report of that same
run is sent again, is put back to its snapshot values by the first statement. The third statement also
reverts the `lastReportedAt` and commit fields that a live report wrote to a `CiRun` after the
snapshot. If reports kept arriving between the snapshot and the rollback, drop `lastReportedAt` and the
three commit fields from the third statement and restore `startedAt` only: ingestion never writes it.
A run that ingestion created between the snapshot and the run of the script is not in the snapshot, so
the first statement does not unlink it if the script linked it. Take the snapshot immediately before
the run. When the result is accepted, remove the snapshot with `DROP SCHEMA backfill_snapshot CASCADE;`.

### Rollback without a snapshot

Without a snapshot the script's changes cannot be separated from live ones, and part of them cannot be
reverted at all:

- Which runs the script linked is not recorded, and neither is which job keys it wrote. A job key on a
  linked run does not say who wrote it: the reporter and live ingestion write the same values.
- Which `CiRun` rows the script created is not recorded.
- The previous `startedAt`, `lastReportedAt` and commit fields of a `CiRun` that already existed are
  not recorded, so a widened `startedAt`, a raised `lastReportedAt` and filled commit fields cannot be
  restored.

Two statements remain, and both are approximations. Before running either, dump `ci_run` and the `id`,
`ciRunId` and `ciJobKey` columns of `run`, and keep the files until the result is accepted:

```
\copy (SELECT * FROM "ci_run") TO 'ci_run.csv' CSV HEADER
\copy (SELECT "id", "ciRunId", "ciJobKey" FROM "run" WHERE "ciRunId" IS NOT NULL OR "ciJobKey" IS NOT NULL) TO 'run_ci_links.csv' CSV HEADER
```

Remove every `CiRun`, including those created by live ingestion, and clear every job key, including
those written by live ingestion, so that no run is left with a job and no CI run. The next report of a
workflow run creates its `CiRun` again and links only the suites it reports.

This variant erases data that exists only in the database, and it cannot be undone from the reporters.
The `CiRun` metadata that live ingestion stored (`workflowName`, `runNumber`, `branch`, `actor` and
the other `ci*` columns) is deleted with its row, and every `ciJobKey` is cleared. Reports that were
already ingested are never sent again, so none of it returns for historical runs; only a workflow run
that reports from now on gets a `CiRun` and job keys again. Every run that was linked is left
unlinked, so it leaves the Actions tab and is reachable only by its direct link and from the suites. Do not
run it without the dump above.

```sql
BEGIN;
UPDATE "run" SET "ciJobKey" = NULL WHERE "ciJobKey" IS NOT NULL;
DELETE FROM "ci_run";
```

Remove only the `CiRun` rows that look like the script's: no workflow metadata. A backfilled `CiRun`
that a 10.1.0 reporter later updated has metadata and is kept. The job keys of the runs of the rows
that are deleted are cleared first, because deleting a row unlinks its runs and leaves their job key:

```sql
BEGIN;
UPDATE "run" r SET "ciJobKey" = NULL
  WHERE r."ciJobKey" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "ci_run" c
      WHERE c.id = r."ciRunId" AND c."workflowName" IS NULL AND c."runNumber" IS NULL AND c."branch" IS NULL
    );
DELETE FROM "ci_run" c
  WHERE c."workflowName" IS NULL AND c."runNumber" IS NULL AND c."branch" IS NULL;
```

This second variant does not unlink the runs the script linked into a `CiRun` that already existed,
does not revert the widened `startedAt`, the raised `lastReportedAt` or the filled commit fields of
those rows, does not clear the job keys the script wrote on runs of a `CiRun` that has metadata, and
deletes every live `CiRun` that has no metadata, for example one created by a report that sent only
`ciRunExternalId` or by ingestion linking a run of a reporter older than 10.1.0 from its id, together
with the link and the job key of its runs.

## Verification status

The grouping, merge, batching, skip and idempotency rules and the job key recovery are covered by unit
tests against an in-memory port, and the Prisma calls (filters, ordering, the `ciRunId IS NULL` guard
on the link, the `ciJobKey IS NULL AND ciRunId IS NOT NULL` guard on the job key, the `groupBy` that
reads the known keys) by unit tests against a mocked client. The resolution of a job key from an
external id is tested with ids produced by the reporter itself. No automated test runs the script
against a real database, which is why "Recommended order" starts on a disposable one. The
concurrent-write guard (the conditional update and the retry after a unique violation) is proven
against an in-memory port and a mocked client, not against concurrent writers on a real database. No
automated test executes the snapshot, the dump or the rollback statements, including the restore of
`ciJobKey` from `run_link`, and none executes the pre-check query for job keys that extend one another.
