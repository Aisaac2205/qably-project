# Run Queries — Reading Runs from the Session-Authenticated UI

`GET /runs` and `GET /runs/:id` are how the Qably web app lists and reads test runs on behalf of a
signed-in user. Unlike `POST /runs/ingest` (see `docs/RUN_INGESTION.md`), these routes are
session-authenticated and organization-scoped: `SessionGuard` (global) plus `OrgScopeGuard` resolve the
caller's organization from the session and the optional `x-organization-id` header, exactly like the
suites module.

They live in the same `RunsModule`, in a second controller (`RunQueriesController`) mounted on the
same `runs` path as the api-key `RunsController`. The two controllers never collide: the api-key
controller only owns `POST /runs/ingest`, marked `@Public()` to bypass the global session guard; this
controller owns every other verb and path under `/runs`, none of which is `ingest`.

## Organization scoping

Every route requires a valid session and resolves the caller's organization the same way the suites
routes do. A run that belongs to a different organization is invisible: `GET /runs/:id` answers `404`,
not `403` — the caller should not be able to distinguish "does not exist" from "exists in an
organization you cannot see".

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
