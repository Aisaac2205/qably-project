# Dashboard redesign

Date: 2026-09-22
Surface: `apps/web` (product), route `/dashboard`
Reference mockup: board "C · Foco" in the design canvas `https://claude.ai/artifact/AwYmmp2LRySYT5ou2ovf18`

## Why

The current dashboard stretches every block to the full content width and stacks seven sections with equal visual weight: KPI row, traceability calendar, project table, pass-rate trend, status donut, recent activity and pending AI proposals. Nothing leads, so nothing reads as important.

The redesign keeps Qably's own UI system (tokens in `apps/web/src/app/globals.css`, Geist Sans and Geist Mono, shadcn primitives adapted to tokens, Phosphor icons) and borrows chart forms and composition from the approved mockup.

## Principles

- Content is capped at `max-w-[1128px]`, centered, so no widget stretches on wide screens.
- One hero: the pass-rate chart. Everything else supports it.
- Cards have a 1px `border-border`, no default shadow, radius within the project scale.
- Numbers use `tabular-nums`; Geist Mono only for numeric data and commit SHAs.
- Colour is semantic only: pass, fail, warn, skip. The chart line is `--qb-chart-line`.
- Tracking never below `tracking-tight`.

## Layout

Top to bottom:

1. **Header**: title, one-line subtitle, period segmented control (7, 30, 90 days, default 30).
2. **KPI cards**, four in a row: pass rate, runs, failed cases, average run duration. Each shows the value for the period, the delta against the previous equal-length period, and a smooth sparkline. Polarity is explicit: fewer failed cases and shorter duration read as good.
3. **Hero, full width**: daily pass rate for the period as a smooth area line, with the previous period as a dashed comparison line. Horizontal grid only, Y axis 80 to 100 percent by default, widening when data falls below 80. The tooltip shows the day, both values, runs and failed runs that day. Keyboard reachable, with an `sr-only` data table following the existing chart pattern.
4. **Two columns, 2fr and 1fr**:
   - **Projects table**: monogram avatar, name, last run relative time, suites, cases, pass-rate bar with value. Sorted by pass rate ascending so risk sits on top. The monogram colour comes from a deterministic hash of the project id over the status-tinted background tokens. No image uploads.
   - **Cases passing gauge**: semicircle of passed over total cases, using the latest run of each suite, with failed, skipped and blocked counts below.
5. **Two columns, 1fr and 1fr**:
   - **Notification channels**: one row per enabled Slack or Discord webhook with its official logo, target name, subscribed event types, 14 daily bars (sent in ink, days with failures in fail colour), sent and failed totals, and a footer with the last delivery. Email appears as a row when the user has any email preference enabled. The row shows the Gmail logo and the subscribed events, with no counter (see Decisions).
   - **Recent activity**: the latest four runs. Each row has the source logo (GitHub Actions, or a Phosphor icon for API and manual runs), project and run name, a status pill, the GitHub mark with commit SHA and commit message, and passed over total cases with relative time.

Responsive: KPIs go 4 → 2 → 1 columns; both two-column rows stack below the `@3xl` container breakpoint; the hero keeps its height and the table scrolls horizontally inside its card on narrow widths.

Removed from the page: traceability calendar, pass-rate trend and donut column, pending AI proposals, and the current KPI row, activity and project status table (replaced).

## Data

The current `GET /dashboard/summary` has a fixed 7-day window and no time series. `/projects` has no case count or pass rate. Deliveries are not exposed. Two new org-scoped endpoints feed the page, guarded like the existing ones (`OrgScopeGuard`, `@CurrentOrg()`, optional `projectId`).

### `GET /dashboard/overview?period=7|30|90&projectId=`

```ts
interface DashboardOverviewRecord {
  period: 7 | 30 | 90
  kpis: {
    passRate: KpiMetric
    runs: KpiMetric
    failedCases: KpiMetric
    avgRunDurationMs: KpiMetric
  }
  passRateSeries: {
    current: DailyPoint[]
    previous: DailyPoint[]
  }
  casesPassing: { passed: number; failed: number; skipped: number; blocked: number; total: number }
  projects: DashboardProjectRow[]
  recentRuns: DashboardActivityRun[]
}

interface KpiMetric { value: number | null; previous: number | null; series: number[] }
interface DailyPoint { date: string; passRate: number | null; runs: number; failedRuns: number }
interface DashboardProjectRow { id: string; name: string; suites: number; cases: number; passRate: number | null; lastRunAt: string | null }
interface DashboardActivityRun {
  id: string
  projectId: string
  projectName: string
  name: string
  status: RunStatus
  source: RunSource
  passed: number
  total: number
  commitSha: string | null
  commitMessage: string | null
  startedAt: string
}
```

Rules:

- Pass rate reuses the definition in `apps/api/src/common/metrics/run-case-metrics.ts`. The period becomes a parameter; the 7-day constant stays as the default for `/dashboard/summary`, which is left untouched.
- `previous` is the equal-length window immediately before the current one.
- Days with no runs have `passRate: null`, and the chart draws a gap instead of a zero.
- Daily buckets use the same timezone resolution as the traceability calendar.
- Sparkline `series` uses the daily buckets for 7 and 30 days and weekly buckets for 90 days.
- Average run duration is `finishedAt - startedAt` over finished runs in the window.
- `casesPassing` aggregates the latest finished run of every suite in scope.
- `recentRuns` returns 4 items.

### `GET /dashboard/channels`

```ts
interface DashboardChannelsRecord {
  webhooks: {
    id: string
    type: 'slack' | 'discord'
    name: string
    eventTypes: NotificationEventType[]
    sent: number
    failed: number
    daily: { date: string; sent: number; failed: number }[]
  }[]
  email: { enabled: boolean; eventTypes: NotificationEventType[] }
  lastDelivery: { webhookId: string; eventType: NotificationEventType; status: 'sent' | 'failed'; deliveredAt: string } | null
}
```

The window is 14 days, independent of the period control. Only enabled webhooks appear. `email` is derived from the current user's `NotificationPreference` rows with channel `email`.

Types live in `packages/types`; both endpoints get unit and e2e coverage.

## Decisions

- **Email counts are out of scope.** `NotificationDelivery.channel` only records `slack | discord`, so tracking email deliveries needs a schema change and processor work. Email shows as a configured channel without numbers until that lands as its own change.
- **No branch in activity.** `Run` stores no branch, so the row shows SHA and message only.
- **Monograms instead of project images.** R2 storage is deferred until a project image carries more than decoration.
- **Components live in `apps/web/src/features/dashboard`.** The shared `packages/ui/src/dashboard` primitives are consumed by the landing preview. Changing them here would move the landing too, so the landing preview is left as is and may diverge.
- **Charts use Recharts 3**, already a dependency, with the existing `--qb-chart-*` tokens. Logos come from `apps/web/public/logos` through `next/image`. The official Gmail mark is added there as `gmail.svg`.

## Removal

Deleted with their tests and i18n keys: the traceability components, hook, grid lib and types; `pass-rate-trend`, `project-status-donut`, `pending-ai-cases`, `kpi-row`, `recent-activity` and `project-status-table`; `resolve-activity-link`, `project-attention` and `sort-projects` if nothing else imports them. The `/dashboard/traceability` endpoint is removed only if no other caller remains. Each symbol is checked for other importers before it is deleted.

## Testing

- API: unit tests for period windows, previous-window math, null days, weekly bucketing, latest-run-per-suite aggregation, delivery bucketing; e2e for both endpoints including org isolation and `projectId` scoping.
- Web: component tests per widget (loading, empty, error, populated), period switching refetch, chart `sr-only` tables, KPI polarity, channel rows with and without email. Fixtures mirror what the API actually emits.
- Push gate: lint, build and typecheck in `apps/api` and `apps/web`.

## Docs

Update `docs/DASHBOARD_METRICS.md`, `docs/DASHBOARD_UI.md` and `apps/web/src/features/dashboard/README.md`. The reasoning goes there, not into code comments.
