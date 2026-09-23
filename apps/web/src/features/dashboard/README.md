# Dashboard

Organization overview: a KPI strip, an executed-cases hero comparison chart, a projects table, a
cases-passing gauge, notification channels and recent activity — plus the traceability calendar,
which is rendered here but consumed by `/quality` rather than `/dashboard` itself.

This is a vertical slice located under `features/dashboard/`. Metric definitions and endpoint
contracts live in `docs/DASHBOARD_METRICS.md`; layout, token contract and accessibility rules live
in `docs/DASHBOARD_UI.md`. This file covers what lives where inside the slice.

## Structure

```text
features/dashboard/
├── api/
│   └── dashboard.api.ts          # apiRequest wrappers: overview, channels, summary, traceability
├── components/
│   ├── dashboard-page.tsx        # Composition: header, KPI strip, hero, projects/gauge row, channels/activity row
│   ├── dashboard-header.tsx      # Title, subtitle, period toggle (7/30/90)
│   ├── kpi-strip.tsx             # 4 KpiTiles (pass rate, runs, failed cases, avg duration) with sparklines and deltas
│   ├── pass-rate-hero.tsx        # Executed-cases comparison chart; see docs/DASHBOARD_UI.md
│   ├── projects-table.tsx        # Ascending-by-pass-rate project table, scrolls inside its own card
│   ├── project-monogram.tsx      # Neutral initials badge (see docs/DASHBOARD_UI.md deviations)
│   ├── cases-gauge-card.tsx      # Gauge over the latest finished run of every in-scope suite
│   ├── channels-card.tsx / channel-row.tsx   # Webhook, email and Qably in-app delivery rows
│   ├── activity-card.tsx / activity-row.tsx  # 4 most recent runs
│   ├── traceability-calendar.tsx # GitHub-style contribution heatmap grid (weeks and days rendering)
│   ├── traceability-section.tsx  # Card shell and filter toolbar wrapping the calendar (used by /quality)
│   └── traceability-tooltip.tsx  # Day tooltip content and describeDay() copy builder
├── hooks/
│   ├── use-dashboard-overview.ts   # GET /dashboard/overview, keyed by period + projectId + tz
│   ├── use-dashboard-channels.ts   # GET /dashboard/channels, keyed by tz
│   ├── use-dashboard-summary.ts    # GET /dashboard/summary — still consumed by /quality only
│   └── use-traceability-calendar.ts # Fetches and builds the calendar grid for a year and filter
├── lib/
│   ├── format.ts                 # formatRelativeTime, formatKpiValue/formatKpiDelta, formatCompactNumber, formatEventCount
│   ├── kpi-delta.ts              # DASHBOARD_KPI_POLARITY + resolveKpiDeltaTone(value, previous, polarity)
│   ├── executed-cases-domain.ts  # buildExecutedCasesPoints, resolveExecutedCasesTrend, resolvePeriodRangeLabel
│   ├── dashboard-projects.ts     # sortDashboardProjects — ascending by passRate, nulls last
│   ├── resolve-last-delivery.ts  # resolveLastDeliveryWebhookName — looks up a webhook name for the channels footer
│   ├── query-keys.ts             # TanStack Query key factory for dashboard queries
│   └── traceability-grid.ts      # Transforms TraceabilityCalendarRecord into grid data
├── types/
│   └── traceability-calendar.ts  # Calendar domain types (CalendarDayData, TraceabilityFilter)
├── test/                         # Vitest and React 19 tests for components, hooks, and helpers
└── README.md
```

## Data

`useDashboardOverview(period, projectId?)` and `useDashboardChannels(projectId?)` both include the
browser's resolved IANA time zone (`useBrowserTimeZone()`) in their query key, so switching zones
invalidates and refetches rather than silently serving buckets computed for a different zone.
`useDashboardSummary()`, `useProjects()` and `useTraceabilityCalendar()` remain — the first two are
now `/quality`-only; the calendar is rendered by this slice's own `TraceabilitySection` but that
component is only mounted from `/quality`, not from `/dashboard`. Nothing on either page reads a
mock store. Each widget manages its own async state (`isLoading`, `isError`, `retry`) independently:
a slow or failed query only affects the Card it belongs to, never the rest of the page.

## Presentational primitives live in `@qably/ui`

`KpiTile`, `Sparkline`, `Gauge`, `PassRateBar`, `DeliveryBars`, `ChartDataTable` and the vendored
`ChartContainer`/`ChartTooltip` chart primitive are shared with the landing preview and live in
`@qably/ui/dashboard` and `@qably/ui/chart` — see `packages/ui/README.md` for their token contract
and props, and `docs/DASHBOARD_UI.md` for the accessibility and responsive rules every chart in this
slice follows.

## Layout

Widgets are individually `@container`-scoped Cards. Grid breakpoints (`@xs`, `@md`, `@2xl`, `@3xl`)
are keyed to widget/row width rather than viewport width, using the shared `max-w-dashboard` token
(`--container-dashboard: 1128px`) rather than an arbitrary Tailwind value. See
`docs/DASHBOARD_UI.md` for the full 390px responsive contract.

## Design

- Typography: headings use `text-2xl font-semibold tracking-tight` (h1) and `text-lg font-medium`
  (h2); body uses `text-sm`. KPI tile values are `text-2xl font-medium tracking-tight`.
- Cards: shadcn/ui `Card` primitives adapted to project tokens, rendered `as="section"` with an
  `h2` `CardTitle`.
- Status: `StatusChip` with icon and text label for color-blind accessibility.
- Icons: Phosphor icons only.
- Colors: CSS tokens only with zero hardcoded values — see `packages/ui/README.md`'s `qb-*`/`--qb-chart-*`
  contract for the charts specifically.
