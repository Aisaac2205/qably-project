# Dashboard

Organization overview covering KPIs, traceability calendar, project status table, pass-rate trends, recent activity, and pending AI cases.

This is a vertical slice located under `features/dashboard/`.

## Structure

```text
features/dashboard/
├── api/
│   └── dashboard.api.ts          # getDashboardSummary, getTraceabilityCalendar (apiRequest wrappers)
├── components/
│   ├── dashboard-page.tsx        # Main composition and grid layout of every widget below
│   ├── kpi-row.tsx               # Row of 4 KPI cards; KpiCard primitive lives in @qably/ui/dashboard
│   ├── pass-rate-trend.tsx       # Pass-rate trend chart; TrendChart primitive lives in @qably/ui/dashboard
│   ├── pending-ai-cases.tsx      # In-review proposals feed with links to the review inbox
│   ├── project-status-table.tsx  # Project table with attention sorting, filtering, and @container collapse
│   ├── recent-activity.tsx       # Runs and CI-commit activity feed with deep links
│   ├── traceability-calendar.tsx # GitHub-style contribution heatmap grid (weeks and days rendering)
│   ├── traceability-section.tsx  # Card shell and filter toolbar wrapping the calendar
│   └── traceability-tooltip.tsx  # Day tooltip content and describeDay() copy builder
├── hooks/
│   ├── use-dashboard-stats.ts       # Aggregates project, summary, and proposal data with async state
│   ├── use-dashboard-summary.ts     # Windowed run metrics and recent activity query
│   └── use-traceability-calendar.ts # Fetches and builds the calendar grid for a year and filter
├── lib/
│   ├── format.ts                # Pure formatting helpers for relative time, pass rate, and counts
│   ├── project-attention.ts     # sortProjectsByAttention() tiering for failing, running, or unmeasured runs
│   ├── query-keys.ts            # TanStack Query key factory for dashboard queries
│   ├── resolve-activity-link.ts # Maps activity rows to internal routes
│   ├── sort-projects.ts         # Sorting and name filtering logic for the project table
│   └── traceability-grid.ts     # Transforms TraceabilityCalendarRecord into grid data
├── types/
│   └── traceability-calendar.ts # Calendar domain types (CalendarDayData, TraceabilityFilter)
├── test/                        # Vitest and React 19 tests for components, hooks, and helpers
└── README.md
```

## Data

Every metric originates from the API. The page calls `useDashboardSummary()` for windowed run metrics and recent activity, `useProjects()` for the project table, `useProposals()` for pending proposals, and `useTraceabilityCalendar()` for the contribution calendar. Nothing on this page reads the mock store. Each widget manages its own async state (`isLoading`, `isError`, `retry`) independently. A slow or failed query only affects the single Card it belongs to without blocking the rest of the dashboard.

`KpiCard` and `TrendChart` are presentational primitives shared with the landing preview and reside in `@qably/ui/dashboard`.

## Layout

Widgets are individually `@container`-scoped Cards. Grid breakpoints (`@md`, `@2xl`, `@3xl`) are keyed to widget width rather than viewport width. A widget collapses to its compact layout as soon as its own column narrows, independent of other elements on the page.

## Design

- Typography: headings use `text-2xl font-semibold tracking-tight` (h1) and `text-lg font-medium` (h2), while body uses `text-sm`.
- KPI numbers: styled with `text-3xl font-semibold tabular-nums font-mono`.
- Cards: shadcn/ui `Card` primitives adapted to project tokens, rendered `as="section"` with an `h2` `CardTitle`.
- Status: `StatusChip` with icon and text label for color-blind accessibility.
- Icons: Phosphor icons only.
- Colors: CSS tokens only with zero hardcoded values.
