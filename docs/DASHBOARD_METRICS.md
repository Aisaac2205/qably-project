# Dashboard Metrics — Server-Owned Quality Snapshot

`GET /dashboard/summary` is the central-panel endpoint from thesis §1.6.1 scope 1: it feeds the
organization dashboard the counts, pass rate, trend and defect count that panel needs, computed
server-side from real `Run` and `RunCase` rows. It also documents how `ProjectListItem.activity`
(consumed by `GET /projects`) is derived, since both share the same metric math.

Everything Review/AI-shaped — proposals, coverage gaps, quality risks — stays mock on the web for
this slice. Neither endpoint invents numbers for that domain; see "What stays underivable" below.

## Why the server owns the clock

The web app's `use-dashboard-stats.ts` currently computes its 7-day window against a frozen
`MOCK_NOW` constant. That is a client deciding what "now" means, which breaks the moment a real
user opens the dashboard on a real day. `GET /dashboard/summary` fixes this at the source: every
windowed metric is computed from `new Date()` taken once, server-side, at the start of the
request. The client receives already-windowed numbers plus the window length (`windowDays`) and
never computes a "now" of its own. The web migration (next slice) replaces the mock hook's
client-side window with a straight read of this response.

## `GET /dashboard/summary?projectId=<id>`

Session-authenticated (`SessionGuard`, global) and organization-scoped (`OrgScopeGuard` +
`@CurrentOrg()`), the same pattern as `runs` and `suites`. `projectId` is optional.

- **Omitted**: every metric describes the whole organization.
- **Given**: every metric is rescoped to that one project, including `totalProjects`, which becomes
  `1` — the response always describes "the projects in the current view," not a mix of scoped and
  unscoped numbers. A `projectId` that does not belong to the caller's organization answers `404`
  (`project-not-found`), the same "not found, not forbidden" rule the rest of the API uses to avoid
  telling a caller that a foreign resource exists.

Response shape (`DashboardSummaryRecord` in `packages/types`):

```json
{
  "totalProjects": 4,
  "totalSuites": 11,
  "totalRuns": 87,
  "runsInWindow": 9,
  "activeRuns": 1,
  "passRate": 0.82,
  "passRateTrend": 0.05,
  "defectsDetected": 3,
  "windowDays": 7,
  "recentRuns": [ /* RunSummaryRecord, newest first, up to 5 */ ],
  "recentCiCommits": [ /* CiCommitActivityRecord, newest first, up to 4 */ ]
}
```

### Metric definitions

| Field | Definition |
| --- | --- |
| `totalProjects` | Count of projects in scope. Org-wide unless `projectId` narrows it to `1`. |
| `totalSuites` | Count of suites in scope. All-time, not windowed. |
| `totalRuns` | Count of runs in scope. All-time, not windowed. |
| `runsInWindow` | Count of runs in scope with `startedAt` inside the current window (`[now - windowDays, now]`, both ends inclusive). This is the thesis's "percentage of tests executed" made concrete as a raw count; `passRate` below is the percentage form. |
| `activeRuns` | Count of runs in scope with `status: "running"`, **not windowed** — this is "what is happening right now," independent of the trailing window. |
| `passRate` | `pass / total` across every `RunCase` belonging to a run in scope with `startedAt` inside the current window, `total` counting every case status (not only terminal ones). `0` when the window has no cases. This mirrors `RunSummaryRecord.passRate` exactly (see `docs/RUN_QUERIES.md`) — one definition of pass rate, reused, not reinvented for the dashboard. |
| `passRateTrend` | `passRate(current window) - passRate(previous window)`, where the previous window is the `windowDays`-long span immediately before the current one, with no gap and no overlap (`previousEnd == currentStart`). Positive means improving, negative means regressing, `0` means unchanged or no data in either window. This is the thesis's "historical trends" requirement, expressed as the simplest possible one-step trend: this period versus the one before it. |
| `defectsDetected` | Count of `RunCase` rows with `status: "fail"` inside the current window — the thesis's "number of defects detected." Read directly off the same current-window tally used for `passRate`, no extra query. |
| `windowDays` | The window length in days, always `7` in this slice (see below). Present so the client is never tempted to hardcode or guess it. |
| `recentRuns` | The `RECENT_RUNS_LIMIT` (5) most recent runs in scope, reusing `RunQueriesService.list()` — the exact same list, sort and `caseCounts`/`passRate` computation `GET /runs` already returns, sliced to the first 5. No duplicate run-summarizing logic. |
| `recentCiCommits` | The `RECENT_CI_COMMITS_LIMIT` (4) most recently active commits in scope that reached CI, one entry each. See "Why CI activity is grouped by commit" below. |

### Why the window is fixed at 7 days, not a query parameter

The window is a named constant (`DASHBOARD_WINDOW_DAYS` in
`apps/api/src/common/metrics/run-case-metrics.ts`), not a `?windowDays=` query parameter. A
variable window multiplies what "the trend" means (trend versus what, exactly, if the caller can
also change the window mid-comparison?) and the thesis does not ask for one — it asks for
"historical trends per project," which a single well-defined trailing window already delivers. A
fixed constant also keeps `passRate` and `passRateTrend` simple to reason about and test: there is
exactly one current window and one previous window, always the same length. If a future slice needs
a configurable range, it is a additive, backward-compatible change (an optional query parameter
defaulting to `DASHBOARD_WINDOW_DAYS`), not a breaking one — nothing here forecloses it.

### Query shape (no N+1)

Per request, the summary is built from a fixed number of queries regardless of how much data is in
scope: two `count`s for `totalSuites`/`totalRuns`, one `count` for `runsInWindow`, one `count` for
`activeRuns`, one `count` (or a constant `1`) for `totalProjects`, two `runCase.groupBy` calls (one
per window) for the pass-rate/defects tally, and one call into `RunQueriesService.list()` (itself
already N+1-free, see `docs/RUN_QUERIES.md`) for `recentRuns`, and two more for `recentCiCommits`
(one `run.groupBy` to pick the most recent commits, one `run.findMany` to load their runs). All of
it runs inside one `Promise.all`.

### Why CI activity is grouped by commit

`scripts/qably-report.mjs` posts one run per JUnit `<testsuite>`, which means one per test file. A
single GitHub Actions workflow run over this repository therefore arrives as dozens of runs that
share a `commitSha`, a `commitMessage` and a run number. Listing raw CI runs showed the same commit
message repeated on every row while saying nothing new.

`recentCiCommits` folds those runs back into the commit that produced them. Each
`CiCommitActivityRecord` carries the rolled-up `status` (a single failing run fails the commit;
`fail` outranks `running`, which outranks `pending`, which outranks `pass`), `runCount`,
`passedRunCount` and `lastRunAt`.

The grouping is deliberately **server-side**. The client only ever receives a page of runs, so
grouping there would report a run count and a status derived from that page: a commit with 214 runs
whose 88th failed would render as "passed" with a count of 5. The service instead selects the most
recent commits first (`run.groupBy` on the indexed `commitSha`), then loads **every** run of those
commits, so both the count and the rolled-up status describe the whole commit.

Grouping key is `commitSha`, not the CI workflow run id. The workflow run id is only recoverable by
parsing `externalId` (`gha-<runId>-<jobId>-...`), which would mean regex-in-SQL against an unindexed
expression; `commitSha` is already indexed on `Run`. The trade-off is that re-running CI on the same
commit merges into one entry, which is the more useful reading for a dashboard: "what is the state
of this change?" rather than "how many times did we retry it?".

## `activity` on `GET /projects`

`ProjectListItem.activity` (`packages/types`) was previously hardcoded to `null` on every project —
`apps/api/src/modules/projects/projects.service.ts` never populated it, even though `Run`/`RunCase`
are real. It is now derived from the same run data, using the same metric functions as the
dashboard summary.

For a project that has **never had a run**, `activity` stays `null` — this is the existing,
unchanged convention: `null` means "not measured yet," never "zero." A project only gets a
populated `activity` once it has run at least once.

For a project with at least one run:

| Field | Definition |
| --- | --- |
| `lastRunStatus` | `status` of that project's most recent run (by `startedAt`). |
| `lastRunAt` | `startedAt` of that project's most recent run, ISO string. |
| `activeRunCount` | Count of that project's runs with `status: "running"`, not windowed (same "right now" semantics as the summary's `activeRuns`). |
| `healthScore` | The project's `passRate` inside the current `DASHBOARD_WINDOW_DAYS` window, rendered as a rounded 0–100 percentage (`Math.round(passRate * 100)`) — the web renders this field as `{healthScore}%`. `null` when the project has no cases counted inside the current window (no runs in the window, or runs with no recorded cases yet) — this follows the same `null`-means-"not measured" rule as `activity` itself, applied at the field level: a project can have run before (`activity` non-null) while still having nothing to measure right now. A real `0` means the window has case data and every one of those cases failed. The web must render these two states differently — never collapse a `null` into a printed `0%`. |

### What stays underivable: `aiPendingCount`

`ProjectActivity.aiPendingCount` belongs to the Review/AI domain (pending AI-extracted proposals
awaiting human review). That domain has no API module yet — no `Proposal` table exists in
`schema.prisma`, by design (out of scope for this slice). It is **not derivable** from real data
right now, and rather than fake a `0` (which would misrepresent "we have no idea" as "there are
truly zero pending proposals"), the API omits the field entirely.

`ProjectActivity.aiPendingCount` was changed from required to optional in `packages/types` to make
this honest: the web must treat a missing `aiPendingCount` the same way it already treats a missing
`activity` object — as "not measured yet," never as `0`. This is the one contract-shape change in
this slice, and it is additive/widening (an optional field is a safe change for existing consumers
that always provided it, like the current web mocks).

### Avoiding N+1 across the whole project list

`ProjectsService.list()` loads activity for every listed project with four queries total, none of
them per-project:

1. `run.findMany` with `distinct: ['projectId']` and `orderBy: { startedAt: 'desc' }` — Postgres's
   `DISTINCT ON` pattern, one row per project: its most recent run.
2. `run.groupBy` by `projectId` where `status: 'running'` — active run counts for every project at
   once.
3. `run.findMany` scoped to the current window (`startedAt` inside `[now - windowDays, now]`) across
   every listed project — just `id` and `projectId`.
4. `runCase.groupBy` by `['runId', 'status']` for every run id from step 3 — the same
   `groupBy`-by-run-then-fold pattern `RunQueriesService.list()` already uses for `caseCounts` (see
   `docs/RUN_QUERIES.md`), extended one level: fold each run's case counts into its project's totals
   using the `runId -> projectId` map from step 3, then compute `healthScore` per project.

Step 4 is skipped entirely (no query issued) when step 3 returns no runs — an empty project list, or
a page of projects with nothing in the current window, costs nothing extra.

## Shared metric math

Every metric above other than plain `count`s comes from
`apps/api/src/common/metrics/run-case-metrics.ts`, a Prisma-free module of pure functions, unit
tested independently of any service (§4.8.3's "strict separation... each can be tested
independently," the same shape as `runs/lib/derive-run-status.ts`):

- `computeMetricsWindow(now, windowDays)` — the current/previous window boundaries.
- `tallyCaseStatuses`, `buildCaseCountsByRun`, `sumCaseCounts` — folding Prisma `groupBy` rows into
  `RunCaseCounts`, at increasing levels of aggregation (all statuses, per run, or summed across
  several runs).
- `computePassRate`, `computeHealthScore`, `computePassRateTrend` — the actual metric formulas.

`RunQueriesService` (the `GET /runs` list endpoint) was refactored to call these same functions
instead of keeping its own private copy — there was previously a second, near-identical
`buildCaseCounts`/`ZERO_COUNTS`/inline-`passRate` implementation local to that service. There is now
exactly one definition of "pass rate" and "case tally" in the codebase, used by `GET /runs`,
`GET /dashboard/summary`, and `GET /projects`.
