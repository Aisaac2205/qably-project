# Dashboard Metrics — Server-Owned Quality Snapshot

Three read endpoints feed the redesigned `/dashboard`: `GET /dashboard/overview` (the hero, the
four KPI cards, the projects table and the cases-passing gauge), `GET /dashboard/channels` (the
notification channels card) and `GET /dashboard/traceability` (still consumed by `/quality`'s
traceability calendar, unchanged in shape). `GET /dashboard/summary` also stays — `/quality`'s KPI
strip and pass-rate trend still call it — and now computes its pass rate with the same pinned
formula as everything else.

Every metric is computed server-side from real `Run` and `RunCase` rows. Nothing on `/dashboard`
reads a mock store or a client-side clock.

## Pass rate: one formula, one place

`packages/types/src/pass-rate.ts` pins the definition every consumer uses:

```ts
passRate = pass / (pass + fail + blocked)
```

`pending` and `running` cases are excluded from both numerator and denominator — they have not
produced a verdict yet, so counting them would dilute the rate with cases that say nothing about
quality. `skipped` cases are excluded too: skipping a case is a decision not to execute it, not an
outcome to average in. `blocked` stays in the denominator and pulls the rate down, because a
blocked case is a recorded outcome (something prevented it from running to completion) rather than
an absence of data.

The result is `null`, never `0`, when `pass + fail + blocked` is `0` — a suite or a day with only
pending, running or skipped cases has **not been measured**, and printing a `0%` would claim a
verdict that does not exist. Every UI surface that renders a pass rate must render this `null` state
distinctly (an em dash, "Not measured yet", a track-only gauge) and must never coerce it to a
printed zero.

`computePassRateTrend(current, previous)` returns `current - previous`, and `null` whenever either
side is `null` — a trend needs two measured points to mean anything.

This project checked whether TestRail, Xray or Allure publish an official pass-rate formula worth
citing here, and could not verify their current definitions against their own documentation inside
this change's scope. Rather than cite a formula that was not independently confirmed, this section
states the rule and its rationale on their own terms, with no vendor citation attached.

### Every consumer, the same function

`computePassRate`/`computePassRateTrend` (re-exported by `apps/api/src/common/metrics/run-case-metrics.ts` as `computeHealthScore`
for the 0–100 percentage form) is the only place this math is written:

| Consumer | What it computes |
| --- | --- |
| `GET /dashboard/overview` `kpis.passRate` | Aggregate pass rate over the resolved window, current and previous. |
| `GET /dashboard/overview` `passRateSeries[].passRate` | Per-bucket pass rate (see "Series granularity" below). |
| `GET /dashboard/overview` `casesPassing` | Raw `RunCaseCounts`; the client derives the rate for the gauge. |
| `GET /dashboard/overview` `projects[].passRate` | Per-project pass rate over the current window. |
| `GET /dashboard/overview` `recentRuns[].passRate` | Per-run pass rate. |
| `GET /dashboard/summary` `passRate`/`passRateTrend` | Same formula, still windowed at the fixed `DASHBOARD_WINDOW_DAYS` (7), used by `/quality`. |
| `GET /projects` `ProjectListItem.activity.healthScore` | Same formula, rendered 0–100. |

## Time zone: the client's clock decides the calendar day

Every endpoint that buckets by day (`overview`, `channels`, `traceability`) accepts an optional
`tz` query parameter. The client sends `Intl.DateTimeFormat().resolvedOptions().timeZone` — the
viewer's own IANA zone, not a stored preference — because a calendar day is a fact about where the
viewer is sitting, not about their organization.

`apps/api/src/common/time-zone/time-zone.ts` resolves it:

- **Missing** `tz` → falls back to `UTC` (`DEFAULT_TIME_ZONE`).
- **Present but not a real IANA zone name** (validated by constructing an `Intl.DateTimeFormat`
  with it and catching the throw, plus a 64-character length cap) → the request is rejected with
  `400`. A silent UTC fallback for a typo'd zone would compute the "wrong" calendar days without
  telling anyone; failing loudly is cheaper than a support ticket about a dashboard that is
  quietly one day off.
- **Present and valid** → canonicalized (`America/Guatemala` stays `America/Guatemala`;
  deprecated aliases resolve to their canonical IANA name) and used for every day boundary in the
  response.

`apps/web`'s `useBrowserTimeZone()` hook resolves the browser's zone once and every dashboard query
key includes it, so switching zones (a laptop travelling, a VPN, a test with a mocked
`Intl.DateTimeFormat`) invalidates and refetches rather than silently serving stale buckets.

### The `AT TIME ZONE` double-application, and the bug it fixes

Every `Run`, `NotificationDelivery` and `Notification` timestamp is stored as a naive
`TIMESTAMP(3)` column that always holds a UTC instant — Prisma never attaches a zone to it. Every
raw SQL query that buckets one of these columns by calendar day uses the same pattern:

```sql
to_char((col AT TIME ZONE 'UTC') AT TIME ZONE ${zone}, 'YYYY-MM-DD')
```

The inner `AT TIME ZONE 'UTC'` tells Postgres "this naive value is UTC," producing a real
`timestamptz` that correctly represents the instant. The outer `AT TIME ZONE ${zone}` then converts
that instant into a naive local timestamp in the viewer's zone, which is what `to_char` buckets by
day.

Applying `AT TIME ZONE zone` directly to the naive column, with no inner UTC step, does the
opposite of what it looks like: Postgres treats the naive value as if it were **already** expressed
in `zone` and converts it to UTC, shifting the timestamp in the wrong direction. `dashboard.service.ts`'s
traceability query had exactly this bug before this change — every day bucket, and the year-boundary
`WHERE` clause, was silently double-negated. The fix wraps both the bucketing expression and the
year-boundary comparison in the same two-step pattern, and the year boundary reads:

```sql
AND col >= ((${`${year}-01-01`})::timestamp AT TIME ZONE ${zone}) AT TIME ZONE 'UTC'
```

— the same idea run in reverse: a local-zone calendar boundary (`YYYY-01-01` in `zone`) converted
forward into the UTC instant that actually starts the year for that viewer.

## `GET /dashboard/overview?period=<7|30|90>&tz=<iana>&projectId=<id>`

Session-authenticated and organization-scoped (`OrgScopeGuard`/`@CurrentOrg()`), same pattern as
every other dashboard route. `period` must be one of `DASHBOARD_PERIODS` (`7`, `30`, `90`); any
other value is `400`. `projectId` narrows every field to that project and `404`s
(`project-not-found`) if it does not belong to the caller's organization — never a `403`, so a
foreign project id reads as "does not exist," not "exists but is forbidden."

### Calendar windows, not rolling windows

`computeCalendarWindow` resolves the **current** window as the `period`-day span ending today
(inclusive) in the resolved zone, and the **previous** window as the equal-length span immediately
before it, with no gap and no overlap (`previousEnd === currentStart`). Both windows are aligned to
midnight boundaries in the viewer's zone, not to "now minus N days" — a KPI card comparing "this
week" to "last week" should compare two calendar weeks, not two arbitrary 168-hour slices that both
include part of today.

### Series granularity: daily for 7/30, weekly for 90

`passRateSeries.current`/`.previous` and every KPI's `series` use one bucket per calendar day for
`period` 7 or 30, and one bucket per 7-day chunk for `period` 90 — a 90-point daily series is too
dense to read as a trend line, and a coarser weekly rollup is legible at that range. The 90-day
buckets are **window-anchored**, not calendar-week-anchored: they chunk the resolved 90-day window
into consecutive 7-day groups starting from the window's own first day, not from the nearest Monday.
An earlier version of this bucketing anchored to ISO week boundaries instead, which meant the last
partial chunk could be misaligned with the window's actual end date; anchoring to the window itself
guarantees exactly 13 buckets that tile the requested range with no gap and no overlap.

A bucket with zero runs reports `passRate: null`, `runs: 0`, `failedRuns: 0` — an unmeasured day is
not a zero day.

### KPI aggregation: sum the buckets, then take the ratio

Each KPI's `value` is **not** the average of its own `series` — it is the pass rate (or count, or
duration average) of the counts summed across every bucket in the window, then reduced once. For
`passRate` specifically this means: sum `pass`/`fail`/`blocked` across every day in the window first,
then divide once (`aggregatePassRate` calls `computePassRate(sumCaseCounts(...))`), rather than
averaging each day's already-divided rate. Averaging per-day rates would weight a day with 2 cases
the same as a day with 2,000; summing counts first and dividing once weights every case equally,
which is the reading a QA lead expects from "the pass rate this month."

`avgRunDurationMs` only counts runs with a `finishedAt` — a run still in flight has no duration yet,
and including it (as `0` or as elapsed-so-far) would understate the average every time a run happens
to be running at request time.

### `casesPassing`: the latest finished run of every in-scope suite

The gauge's numbers come from a different query than the series: for every suite in scope (the
whole organization, or one project when `projectId` narrows it), only its single most recent
**finished** run (`status IN ('pass', 'fail')`, `finishedAt IS NOT NULL`) contributes case counts,
selected with `ROW_NUMBER() OVER (PARTITION BY suiteId ORDER BY startedAt DESC)`. This answers "if
I ran every suite once right now, what would pass?" — a suite with ten runs today should count once,
not ten times, or its case counts would dominate a suite that only ran once.

### Projects and recent runs

`projects[].passRate` is the project's pass rate over the **current** window only, computed from the
same per-project, per-window case tally the series is built from — not `healthScore` on a 0–100
scale, and not the all-time pass rate. `recentRuns` returns exactly the 4 most recently started runs
in scope, each carrying its own pass rate and a `casesPassed`/`casesTotal` pair rather than a
formatted string, so the client decides how to render "244/300" or a bare percentage.

## `GET /dashboard/channels?tz=<iana>`

Session-authenticated, organization- and user-scoped. Unlike `overview`, this endpoint ignores
`period` entirely: webhook, email and in-app delivery stats always use a **fixed 14-day window**
(`CHANNELS_WINDOW_DAYS`), because "how has this channel been delivering lately" is a health check,
not a metric the reader tunes — changing it with the page's period control would make the channels
card answer a different, unstated question every time someone changed the KPI window.

### Webhooks

Only webhooks with `enabled: true` are included. Each one reports `sent`/`failed` totals and a
14-entry `daily` array (`{date, sent, failed}`) over the fixed window, aggregated from
`NotificationDelivery` rows scoped to that `webhookId`.

### Email

`email.enabled`/`email.eventTypes` are derived by merging the calling user's `NotificationPreference`
rows (`channel: 'email'`) over `DEFAULT_NOTIFICATION_PREFERENCES` — an event type with no stored row
falls back to its default rather than reading as disabled, since most users never touch their
notification settings and the defaults are what they are actually receiving. `email.enabled` is
`true` once at least one effective event type is on.

Email deliveries are now recorded and counted the same way webhook deliveries are (added in this
change): every send attempt from `notifications.processor.ts`'s email path upserts a
`NotificationDelivery` row (`channel: 'email'`, `userId` set, `webhookId` null) on success or
failure, so `email.sent`/`email.failed`/`email.daily` report real delivery history instead of the
counter-less "is this channel on" state the endpoint originally returned. The email delivery query
is scoped by `organizationId + userId + channel = 'email'` and, unlike the webhook query, is **not**
skipped when the organization has zero webhooks configured — a user's email deliveries are
independent of whether any webhook exists.

### Qably in-app channel

`inApp.sent`/`inApp.unread`/`inApp.daily` report the calling user's own in-app `Notification` rows
over the same fixed 14-day window, scoped to `organizationId + userId`. This is per-user by design —
two people in the same organization can have different unread counts — unlike the webhook and email
rows, which describe organization- or user-scoped delivery infrastructure rather than personal inbox
state.

### `lastDelivery`

The single most recent delivery across every included channel (`webhooks` with `enabled: true`,
plus the user's own email and, since `lastDelivery` predates the in-app addition, the query that
resolves it), returned as an object (`webhookId | null`, `channel`, `eventType`, `status`,
`deliveredAt`) rather than a bare id, so the client never has to look the webhook back up to label
the row. `webhookId` is `null` for email deliveries, which have no webhook to point at. The query
always runs, even when the organization has zero enabled webhooks, because the most recent delivery
could still be the user's own email.

## `GET /dashboard/traceability?year=<YYYY>&tz=<iana>&projectId=<id>`

Unchanged in shape from before this change — still consumed by `/quality`'s traceability calendar,
still returns per-stage day counts for `scm`, `proposals`, `official` and `runs` with days that had
no activity omitted rather than padded. What changed is that it now accepts the same dynamic `tz`
query parameter as `overview` and `channels` (previously bucketed on a hardcoded
`TRACEABILITY_TIME_ZONE = 'America/Guatemala'` constant regardless of who was looking), and both its
day-bucketing query and its year-boundary `WHERE` clause now use the corrected
`(col AT TIME ZONE 'UTC') AT TIME ZONE zone` pattern described above — the same direction-bug fix
this change made everywhere else.

## `GET /dashboard/summary` and `ProjectListItem.activity` — unchanged shape, same pinned formula

`/quality`'s KPI strip and pass-rate trend still call `GET /dashboard/summary`, and `GET /projects`
still returns `ProjectListItem.activity.healthScore`. Neither endpoint's window logic changed in
this redesign (both still use the fixed, non-timezone-aware `DASHBOARD_WINDOW_DAYS` window), but
both now compute their pass rate through the same pinned `computePassRate` this document describes,
so a suite's pass rate reads identically whether it is seen on `/dashboard`, `/quality` or the
`/projects` list. See `docs/RUN_QUERIES.md` for `RunSummaryRecord.passRate`, which follows the same
rule.

## Shared metric math

`apps/api/src/common/metrics/run-case-metrics.ts` stays the Prisma-free module of pure, independently
unit-tested functions backing every consumer above (`tallyCaseStatuses`, `buildCaseCountsByRun`,
`sumCaseCounts`, `computeHealthScore`). `apps/api/src/common/metrics/dashboard-overview.ts` and
`apps/api/src/common/metrics/delivery-activity.ts` are the equivalent pure builders for the two new
endpoints, taking already-queried rows and returning the response record with zero Prisma calls
inside them — the same "strict separation, independently testable" shape as the rest of this module.
