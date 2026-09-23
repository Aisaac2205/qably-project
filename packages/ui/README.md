# @qably/ui

Shared React 19 component library containing dashboard analytics primitives, charts, and status indicators consumed by `apps/web` and `apps/landing`.

## Overview

The package encapsulates presentational telemetry components. It enforces strict accessibility standards and relies entirely on CSS custom properties defined by the consuming application's theme.

## Exported Components

### `./chart`

- `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, `ChartConfig`: a Recharts 3 chart primitive vendored from shadcn/ui and rewritten to speak only the `qb-*` token contract below. `ChartConfig` colors are typed as `` `var(--qb-chart-${string})` ``, so a raw hex/oklch/named color fails to compile. `ChartContainer` always forwards `initialDimension` to Recharts' `ResponsiveContainer` — pass the chart's intrinsic design size so it renders correctly before `ResizeObserver` fires (and in test environments where `ResizeObserver` does not exist at all).
- `useCoarsePointer`: hook over `matchMedia('(pointer: coarse)')` used to switch a chart's tooltip trigger from hover to click on touch devices.

### `./dashboard`

- `KpiCard`: Metric card displaying total counts, percentage deltas, and directional change indicators.
- `TrendChart`: Historical pass-rate trend chart powered by Recharts, rendering responsive area and line layers.
- `Sparkline`: Compact SVG trendline designed for embedding within dense data table rows.
- `StatusChip`: Accessible status badge that always pairs a Phosphor icon with a text label.
- `StatusDonut`: Circular distribution chart illustrating test execution verdicts (pass, fail, skip, blocked).
- `Link`: Accessible anchor element wrapper.

## Design Token Contract

Components never hardcode hex, rgb, or oklch colors. They speak only Tailwind `qb-*` utility classes and, for charts, raw `--qb-chart-*` CSS variables — never the app's own token names directly. Each consuming app binds every `qb-*` name to its own token file: `apps/web/src/app/globals.css` binds them to its light OKLCH tokens, `apps/landing/src/styles/global.css` binds them to its dark hex/rgba mirror. The two files are separate systems; never copy a token block or a value from one into the other.

### `--color-qb-*` (Tailwind utilities, declared in each app's `@theme inline`)

`qb-canvas`, `qb-canvas-hover`, `qb-surface`, `qb-surface-raised`, `qb-fg`, `qb-muted`, `qb-border`, `qb-border-strong`, `qb-primary`, `qb-primary-hover`, `qb-primary-fg`, `qb-ai`, `qb-ai-bg`, `qb-pass`, `qb-pass-bg`, `qb-fail`, `qb-fail-bg`, `qb-blocked`, `qb-blocked-bg`, `qb-skip`, `qb-skip-bg`, `qb-running`, `qb-running-bg`, `qb-warn`, `qb-warn-bg`, `qb-heatmap-l0..l4`. Shadows: `shadow-qb-card`, `shadow-qb-pop`.

### `--qb-chart-*` (raw CSS vars, declared in each app's `:root`)

`--qb-chart-line`, `--qb-chart-grid`, `--qb-chart-pass`, `--qb-chart-fail`, `--qb-chart-skip`, `--qb-chart-compare`. Chart components read these directly (e.g. `stroke="var(--qb-chart-line)"` or as a `ChartConfig` series `color`) because Tailwind's `@theme inline` values are not guaranteed to exist as runtime custom properties — `ChartConfig.color` is typed to require this `var(--qb-chart-*)` form.

Both `apps/web` and `apps/landing` `@source` this package's `src` directory so Tailwind picks up every `qb-*` utility class used inside it.

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
