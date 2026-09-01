# Run Queries — Reading and Driving Runs from the Session-Authenticated UI

`GET /runs`, `GET /runs/:id`, `POST /runs` and `PATCH /runs/:runId/cases/:caseId` are how the Qably
web app lists, reads, starts and drives test runs on behalf of a signed-in user. Unlike
`POST /runs/ingest` (see `docs/RUN_INGESTION.md`), these routes are session-authenticated and
organization-scoped: `SessionGuard` (global) plus `OrgScopeGuard` resolve the caller's organization
from the session and the optional `x-organization-id` header, exactly like the suites module.

They live in the same `RunsModule`, in a second controller (`RunQueriesController`) mounted on the
same `runs` path as the api-key `RunsController`. The two controllers never collide: the api-key
controller only owns `POST /runs/ingest`, marked `@Public()` to bypass the global session guard; this
controller owns every other verb and path under `/runs`, none of which is `ingest`.

## Organization scoping

Every route requires a valid session and resolves the caller's organization the same way the suites
routes do. A run that belongs to a different organization is invisible: `GET /runs/:id` and the case
`PATCH` both answer `404`, not `403` — the caller should not be able to distinguish "does not exist"
from "exists in an organization you cannot see".

## `GET /runs?projectId=<id>`

Lists runs in the caller's organization, newest first (`startedAt` descending). `projectId` is
optional; omitting it returns every run across every project in the organization, which is what an
organization-wide dashboard needs.

The list response does **not** embed each run's cases. Sending every case of every run back for a list
view is wasteful — the list only needs to render a status pill and a pass rate. Instead each item
carries a `caseCounts` object with a slot per `CaseStatus` plus `total`, and a `passRate`:

```json
{
  "id": "run_abc123",
  "projectId": "project_123",
  "organizationId": "org_123",
  "suiteId": "suite_123",
  "name": "Checkout regression",
  "status": "running",
  "source": "manual",
  "externalId": "",
  "startedAt": "2026-09-01T10:00:00.000Z",
  "caseCounts": {
    "total": 4,
    "pending": 1,
    "running": 0,
    "pass": 2,
    "fail": 1,
    "skip": 0,
    "blocked": 0
  },
  "passRate": 0.5
}
```

`passRate` is `pass / total` (against every case in the run, not only the ones that have finished),
and `0` for a run with no cases. It is computed server-side and shipped as a field so the client never
has to derive it from the counts itself — see `RunSummaryRecord` and `RunCaseCounts` in
`packages/types`.

The counts come from one `prisma.runCase.groupBy` call across all listed runs, not one query per run.

## `GET /runs/:id`

Returns the full run, including every case ordered by `position`. This is the detail view, where
sending the whole case list is the point.

## `POST /runs` — starting a manual run

Body:

```json
{
  "projectId": "project_123",
  "suiteId": "suite_123",
  "name": "Pre-release smoke check"
}
```

`name` is optional and defaults to the suite's name.

Behavior:

- `source` is always `manual`, `externalId` is always `null`, `status` starts at `pending`, and
  `executedById` is the session user — this is the one path where Qably knows exactly who ran the
  test.
- The suite must belong to the given `projectId` inside the caller's organization; a mismatch on
  either (wrong project, wrong organization, or a suite that does not exist) answers `404` with
  `suite-not-found`. The endpoint does not distinguish which part of the pair was wrong, for the same
  reason cross-organization runs answer `404` and not `403`.
- A suite with zero `TestCase` rows is rejected with `400` — a run cannot execute nothing.
- The run's cases are **snapshotted** from the suite's current `TestCase` rows at creation time:
  `name`, `steps`, `expectedResult` are copied, `testCaseId` is linked, `position` follows the suite's
  own case order, and every case starts `pending`. This is deliberate: it is audit evidence of what was
  executed. If a test case is edited or reordered after the run starts, the run's snapshot must not
  silently change underneath it — the same principle `RUN_INGESTION.md` applies to reported cases
  applies here to the run's starting state.

The whole write (suite lookup already happened outside the transaction; the run insert and the case
snapshot insert) happens inside a single `prisma.$transaction`.

### Why `externalId: null` never collides across manual runs

`Run` has `@@unique([projectId, source, externalId])` and `externalId` is nullable. In PostgreSQL (and
per the Prisma 7 schema reference), `NULL` values in a unique index are treated as distinct from every
other `NULL` — a unique constraint never rejects a second row with `NULL` in the constrained column.
This was verified directly against the project's Postgres instance: two `Run` rows created with
`source: 'manual'`, `externalId: null` for the same `projectId`, inside a transaction that was then
rolled back, both persisted without a constraint violation. No workaround, no synthetic per-run
`externalId`, and no migration were needed — manual runs simply rely on standard SQL NULL semantics for
uniqueness.

## `PATCH /runs/:runId/cases/:caseId` — recording a case result

Body:

```json
{ "status": "pass" }
```

`status` must be one of `pass`, `fail`, `skip`, `blocked` — `pending` and `running` cannot be set
through this endpoint, since those are the run's own starting/in-flight states, not an outcome a human
records. This is the endpoint the keyboard shortcuts described in thesis §4.7.3 call: one case, one
cheap request.

On a successful patch:

1. The case's `status` and `recordedAt` (set to the current time) are updated.
2. The run's `status` is recomputed from every case's current status using the existing
   `deriveRunStatus` helper from `RUN_INGESTION.md`'s ingestion path — the same precedence rules apply
   to a manual run as to an ingested one, so a dashboard cannot tell the two apart by looking at how
   status is derived.
3. `finishedAt` is set to the current time only when no case remains `pending` or `running`, and only
   if the run had not already finished. Once set, a later patch never overwrites it — finishing is a
   one-way transition for a manual run, since this endpoint can only move a case away from `pending`,
   never back to it.

The response is the full updated run with its cases, the same shape `GET /runs/:id` returns, so the UI
can re-render immediately after a single keystroke without a second round trip.
