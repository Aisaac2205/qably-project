# Dashboard

Organization overview — KPIs, traceability calendar, project status table, pass-rate trend, recent activity, and pending AI cases.

**Vertical slice** under `features/dashboard/`.

## Structure

```
features/dashboard/
├── api/
│   └── dashboard.api.ts          # getDashboardSummary, getTraceabilityCalendar (apiRequest wrappers)
├── components/
│   ├── dashboard-page.tsx        # Main composition — grid layout of every widget below
│   ├── kpi-row.tsx                # Row of 4 KPI cards (runs, defects, pending AI, active runs); KpiCard itself lives in @qably/ui/dashboard
│   ├── pass-rate-trend.tsx       # Pass-rate trend chart; TrendChart itself lives in @qably/ui/dashboard
│   ├── pending-ai-cases.tsx      # In-review proposals feed, links to the review inbox
│   ├── project-status-table.tsx  # Project table — attention sort default, name/lastRun/passRate/suites sort, name filter, @container collapse
│   ├── recent-activity.tsx       # Runs + CI-commit activity feed with real deep links
│   ├── traceability-calendar.tsx # GitHub-style contribution heatmap grid (weeks/days rendering)
│   ├── traceability-section.tsx  # Card shell + filter toolbar wrapping the calendar
│   └── traceability-tooltip.tsx  # Day tooltip content + describeDay() copy builder
├── hooks/
│   ├── use-dashboard-stats.ts        # Aggregates useProjects/useDashboardSummary/useProposals into DashboardStats + per-source async state
│   ├── use-dashboard-summary.ts      # useDashboardSummary() — windowed run metrics and recent activity query
│   └── use-traceability-calendar.ts  # useTraceabilityCalendar() — fetches + builds the calendar grid for a year/filter
├── lib/
│   ├── format.ts                 # Pure formatting helpers (relative time, pass rate, numbers, event counts)
│   ├── project-attention.ts      # sortProjectsByAttention() — failing/running/unmeasured-first tiering
│   ├── query-keys.ts             # dashboardKeys — TanStack Query key factory
│   ├── resolve-activity-link.ts  # resolveRunLink/resolveProposalLink/resolveCiCommitLink — activity row → route
│   ├── sort-projects.ts          # sortProjects()/filterProjectsByName() — project table sort + name search
│   └── traceability-grid.ts      # buildTraceabilityGrid() — TraceabilityCalendarRecord → calendar grid data
├── types/
│   └── traceability-calendar.ts  # Calendar domain types (CalendarDayData, TraceabilityFilter, etc.)
├── test/                         # Vitest + React 19 tests, one file per component/hook/lib module
└── README.md
```

## Data

Every number comes from the API: `useDashboardSummary()` for the windowed run metrics and recent activity, `useProjects()` for the project table, `useProposals()` (review inbox) for pending proposals, and `useTraceabilityCalendar()` for the contribution calendar. Nothing on this page reads the mock store. Each widget owns its own async state (`isLoading`/`isError`/`retry`) instead of gating the whole page — a slow or failed query only blanks the one Card it belongs to.

`KpiCard` and `TrendChart` are presentational primitives shared with the landing preview and live in `@qably/ui/dashboard`, not in this feature folder.

## Layout

Widgets are individually `@container`-scoped Cards. Grid breakpoints (`@md`, `@2xl`, `@3xl`) are keyed to widget width, not viewport width, so a widget collapses to its compact layout as soon as its own column narrows — independent of what else is on the page.

## Design

- Typography: h1 `text-2xl font-semibold tracking-tight`, h2 `text-lg font-medium`, body `text-sm`
- KPI numbers: `text-3xl font-semibold tabular-nums font-mono`
- Cards: shadcn/ui `Card` primitives adapted to project tokens, rendered `as="section"` with an `h2` `CardTitle`
- Status: `StatusChip` with icon + label (color-blind safe)
- Icons: Phosphor only
- Colors: tokens only, no hardcoded values
