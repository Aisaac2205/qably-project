# Dashboard

Organization overview — KPIs, project health grid, and recent activity feed.

**Vertical slice** under `features/dashboard/`.

## Structure

```
features/dashboard/
├── components/
│   ├── dashboard-page.tsx      # Main composition
│   ├── kpi-card.tsx            # Single KPI display card
│   ├── kpi-row.tsx             # Responsive row of KPI cards
│   ├── project-health-card.tsx # Per-project health summary
│   └── recent-activity.tsx     # Runs, AI cases, pipelines feed
├── hooks/
│   └── use-dashboard-stats.ts  # Derived stats from the dashboard summary, projects and review APIs
├── lib/
│   └── format.ts               # Pure formatting helpers
├── test/                       # Vitest + React 19 tests
└── README.md
```

## Data

Every number comes from the API: `useDashboardSummary()` for the windowed run metrics and recent activity, `useProjects()` for the project table, and the review inbox's `useProposals()` for pending proposals. Nothing on this page reads the mock store. The presentational blocks (KPI card, trend chart, status chip) come from `@qably/ui/dashboard`, the same components the landing renders in its preview.

## Design

- Typography: h1 `text-2xl font-semibold tracking-tight`, h2 `text-lg font-medium`, body `text-sm`
- KPI numbers: `text-3xl font-semibold tabular-nums font-mono`
- Cards: shadcn/ui `Card` primitives adapted to project tokens
- Status: `StatusChip` with icon + label (color-blind safe)
- Icons: Phosphor only
- Colors: tokens only, no hardcoded values
