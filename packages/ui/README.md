# @qably/ui

Shared React 19 component library containing dashboard analytics primitives, charts, and status indicators consumed by `apps/web` and `apps/landing`.

## Overview

The package encapsulates presentational telemetry components. It enforces strict accessibility standards and relies entirely on CSS custom properties defined by the consuming application's theme.

## Exported Components

- `KpiCard`: Metric card displaying total counts, percentage deltas, and directional change indicators.
- `TrendChart`: Historical pass-rate trend chart powered by Recharts, rendering responsive area and line layers.
- `Sparkline`: Compact SVG trendline designed for embedding within dense data table rows.
- `StatusChip`: Accessible status badge that always pairs a Phosphor icon with a text label.
- `StatusDonut`: Circular distribution chart illustrating test execution verdicts (pass, fail, skip, blocked).
- `Link`: Accessible anchor element wrapper.

## Design Token Contract

Components do not hardcode hex, rgb, or oklch colors. Instead, they expect the consuming application to provide CSS tokens in the root stylesheet:

- `--status-pass`, `--status-fail`, `--status-skip`, `--status-blocked`, `--status-running`
- `--primary`, `--border`, `--text-muted`, `--bg-card`

## Peer Dependencies

The package requires the following peer dependencies:

- `react`: `^19.0.0`
- `react-dom`: `^19.0.0`
- `@phosphor-icons/react`: `^2.1.10`

## Available Scripts

Run scripts from this directory or from the root workspace using `pnpm --filter @qably/ui <command>`.

### Testing

Run DOM and component tests with Vitest:

```bash
pnpm run test
```

### Type Checking

Verify component prop types and TypeScript declarations:

```bash
pnpm run type-check
```
