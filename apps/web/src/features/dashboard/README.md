# Dashboard

Organization overview: a KPI strip, an executed-cases hero comparison chart, a projects table, a
case-priority donut, notification channels and recent activity. The slice also holds the
traceability calendar, which no page renders at the moment, and `KpiStrip`, which the project
quality page reuses scoped to one project.

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
│   ├── dashboard-header.tsx      # Subtitle and period dropdown (7/30/90)
│   ├── kpi-strip.tsx             # 4 KpiStatCards (executed cases, runs, failed cases, failed runs) with mini area charts and trend
│   ├── pass-rate-hero.tsx        # Executed-cases comparison chart; see docs/DASHBOARD_UI.md
│   ├── projects-table.tsx        # Ascending-by-pass-rate project table with a PassRateBar per row
│   ├── project-monogram.tsx      # Neutral initials badge (see docs/DASHBOARD_UI.md deviations)
│   ├── cases-gauge-card.tsx      # Donut of case priorities (critical, high, medium, low) with a legend
│   ├── channels-card.tsx / channel-row.tsx   # Webhook, email and Qably in-app delivery rows
│   ├── activity-card.tsx / activity-row.tsx  # recentActivity entries: commits (grouped runs) and standalone runs
│   └── traceability-calendar.tsx / traceability-tooltip.tsx   # Contribution calendar; not rendered by any page today
├── hooks/
│   ├── use-dashboard-overview.ts   # GET /dashboard/overview, keyed by period + projectId + tz
│   ├── use-dashboard-channels.ts   # GET /dashboard/channels, keyed by tz
│   ├── use-dashboard-summary.ts    # GET /dashboard/summary
│   └── use-traceability-calendar.ts   # GET /dashboard/traceability, keyed by year + projectId + tz
├── lib/
│   ├── format.ts                 # formatRelativeTime, formatKpiValue/formatKpiDelta, formatCompactNumber, formatEventCount
│   ├── kpi-delta.ts              # DASHBOARD_KPI_POLARITY + resolveKpiDeltaTone(value, previous, polarity)
│   ├── executed-cases-domain.ts  # buildExecutedCasesPoints, resolveExecutedCasesTrend, resolvePeriodRangeLabel
│   ├── dashboard-projects.ts     # sortDashboardProjects — ascending by passRate, nulls last
│   ├── resolve-last-delivery.ts  # resolveLastDeliveryWebhookName — looks up a webhook name for the channels footer
│   ├── series-date.ts            # parseSeriesDate (local midnight), formatSeriesDayLabel, formatSeriesRange
│   ├── traceability-grid.ts      # buildTraceabilityGrid, computeLevelThresholds, weekdayNames
│   └── query-keys.ts             # TanStack Query key factory for dashboard queries
├── types/
│   └── traceability-calendar.ts  # Calendar domain types
├── test/                         # Vitest and React 19 tests for components, hooks, and helpers
└── README.md
```

`kpi-delta.ts` and `formatKpiDelta` have no consumer outside tests.

## Data

`useDashboardOverview(period, projectId?)` and `useDashboardChannels()` both include the
browser's resolved IANA time zone (`useBrowserTimeZone()`) in their query key, so switching zones
invalidates and refetches rather than silently serving buckets computed for a different zone.
The channels endpoint is organization-wide and takes no project filter.
Nothing on either page reads a mock store. Each widget manages its own async state (`isLoading`, `isError`, `retry`) independently:
a slow or failed query only affects the Card it belongs to, never the rest of the page.

## Presentational primitives

This slice imports `PassRateBar`, `DeliveryBars`, `ChannelStat`, `ChartDataTable` and
`ActivityEntryRow` from `@qably/ui/dashboard` — see `packages/ui/README.md` for their token contract
and props. The area, bar and pie charts come from `apps/web/src/components/charts`, and the KPI card
is `components/ui/kpi-stat-card.tsx`. See `docs/DASHBOARD_UI.md` for the accessibility and
responsive rules every chart in this slice follows.

## Layout

Widgets are individually `@container`-scoped Cards. Grid breakpoints (`@xs`, `@md`, `@lg`, `@2xl`, `@3xl`)
are keyed to widget/row width rather than viewport width, using the shared `max-w-dashboard` token
(`--container-dashboard: 1128px`) rather than an arbitrary Tailwind value. See
`docs/DASHBOARD_UI.md` for the full 390px responsive contract.

## Design

- Typography: the page heading is an `sr-only` `h1` in `app/(app)/dashboard/page.tsx`; card titles
  are `h2` `CardTitle`s (`text-base font-semibold tracking-tight` by default); body uses `text-sm`.
  KPI values are `text-3xl font-semibold tracking-tight`.
- Cards: shadcn/ui `Card` primitives adapted to project tokens; the projects, gauge, channels and
  activity cards render `as="section"` with an `h2` `CardTitle`.
- Status: activity rows render `StatusChip` from `@qably/ui/dashboard`, with icon and text label for
  color-blind accessibility.
- Icons: Phosphor icons only.
- Colors: CSS tokens only with zero hardcoded values — see `packages/ui/README.md`'s `qb-*`/`--qb-chart-*`
  contract for the charts specifically.
