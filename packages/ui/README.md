# @qably/ui

Shared React 19 component library containing dashboard analytics primitives, charts, and status indicators consumed by `apps/web` and `apps/landing`.

## Overview

The package encapsulates presentational telemetry components. It enforces strict accessibility standards and relies entirely on CSS custom properties defined by the consuming application's theme.

## Exported Components

### `./chart`

- `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, `ChartConfig`: a Recharts 3 chart primitive vendored from shadcn/ui and rewritten to speak only the `qb-*` token contract below. `ChartConfig` colors are typed as `` `var(--qb-chart-${string})` ``, so a raw hex/oklch/named color fails to compile. `ChartContainer` always forwards `initialDimension`, and optionally `width`/`height`, to Recharts' `ResponsiveContainer` — pass the chart's intrinsic design size so it renders correctly before `ResizeObserver` fires (and in test environments where `ResizeObserver` does not exist at all). `ChartStyle` injects the config's CSS custom properties as an inline `<style>` tag scoped to the container's generated id, so two chart instances on the same page never leak each other's colors.
- `useCoarsePointer`: hook over `matchMedia('(pointer: coarse)')` used to switch a chart's tooltip trigger from hover to click on touch devices.

### `./dashboard`

- `Sparkline`: Compact area chart (built on `ChartContainer`) for embedding a trend inside a KPI tile or table cell. Accepts `values: readonly (number | null)[]` — a run of `null`s renders an empty placeholder via `emptyLabel`; a single defined point renders a static dot rather than a chart. `tone` (`'pass' | 'fail' | 'muted' | 'primary' | 'warn'`) maps to a `--qb-chart-*` variable.
- `Gauge`: Half-donut (`PieChart`, 180°→0°) showing a single `value: number | null` against a 0–100 scale, with a `track`/`value` two-layer pie so the unfilled portion stays visible. `null` renders a full, unfilled track with `role="img"`; a real value renders `role="meter"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext`. `width`/`height` default to 240×132; the centre label is passed as `children`, not a prop, so callers control its typography.
- `PassRateBar`: A single-row percentage bar with the same `null` → `role="img"`, real value → `role="meter"` contract as `Gauge`. `warnBelow` (default 90) switches its fill tone; an explicit `color` prop overrides the computed tone entirely.
- `DeliveryBars`: A 14-day (or any length) bar strip for one notification channel — `sent`/`failed` counts per day, tallest-sent-day-relative bar heights, plus its own `ChartDataTable` mirror.
- `ChartDataTable`: A generic `sr-only` table (`caption`, typed `columns`, `rowKey`) that every chart above renders alongside itself so assistive technology gets the same series a sighted user sees plotted.
- `KpiTile`: The KPI-strip metric tile — `label`, `value`, an optional `delta` (`{text, tone: 'better' | 'worse' | 'neutral', srText}`, tone and polarity decided by the caller, e.g. `apps/web`'s `lib/kpi-delta.ts`), and a `children` slot for a `Sparkline`. Is itself a `@container` and stacks its value above its sparkline below 220px of its own width.
- `ChannelStat`: A stacked number-over-unit stat for a notification channel row (`value`, `unit`, `srText`, optional `tone: 'default' | 'muted' | 'pass' | 'fail'`). The visual number/unit stack is `aria-hidden`; `srText` is the single accessible phrase announced for the whole stat, so callers pass an already-translated, already-pluralised string.
- `StatusChip`: Accessible status badge that always pairs a Phosphor icon with a text label.
- `ActivityEntryRow`: A recent-activity row for a commit (grouped, `kind: 'commit'`) or a standalone run (`kind: 'run'`). Purely presentational — every icon, label, relative time and cases summary string arrives pre-resolved as a prop; `sourceIcon`/`commitIcon` are `ReactNode` slots so the caller owns its own icon assets and router. Commit rows render the SHA cut to 7 characters (`commitSha.slice(0, 7)`) with the full SHA in `title`, and truncate `commitMessage` with the full text in `title`.
- `Link`: Accessible anchor element wrapper (`DefaultLink`); components that navigate accept a `linkComponent` prop instead of importing a router, so `apps/web` can inject `next/link` while `apps/landing` uses a plain anchor.

`KpiCard`, `TrendChart` and `StatusDonut` were removed once the dashboard redesign replaced every consumer that used them; `Gauge`, `PassRateBar`, `DeliveryBars`, `ChartDataTable` and `KpiTile` are what replaced them.

## Design Token Contract

Components never hardcode hex, rgb, or oklch colors. They speak only Tailwind `qb-*` utility classes and, for charts, raw `--qb-chart-*` CSS variables — never the app's own token names directly. Each consuming app binds every `qb-*` name to its own token file: `apps/web/src/app/globals.css` binds them to its light OKLCH tokens, `apps/landing/src/styles/global.css` binds them to its dark hex/rgba mirror. The two files are separate systems; never copy a token block or a value from one into the other.

### `--color-qb-*` (Tailwind utilities, declared in each app's `@theme inline`)

`qb-canvas`, `qb-canvas-hover`, `qb-surface`, `qb-surface-raised`, `qb-fg`, `qb-muted`, `qb-border`, `qb-border-strong`, `qb-primary`, `qb-primary-hover`, `qb-primary-fg`, `qb-ai`, `qb-ai-bg`, `qb-pass`, `qb-pass-bg`, `qb-fail`, `qb-fail-bg`, `qb-blocked`, `qb-blocked-bg`, `qb-skip`, `qb-skip-bg`, `qb-running`, `qb-running-bg`, `qb-warn`, `qb-warn-bg`, `qb-heatmap-l0..l4`. Shadows: `shadow-qb-card`, `shadow-qb-pop`.

### `--qb-chart-*` (raw CSS vars, declared in each app's `:root`)

`--qb-chart-line`, `--qb-chart-grid`, `--qb-chart-pass`, `--qb-chart-fail`, `--qb-chart-skip`, `--qb-chart-warn`, `--qb-chart-compare`. Chart components read these directly (e.g. `stroke="var(--qb-chart-line)"` or as a `ChartConfig` series `color`) because Tailwind's `@theme inline` values are not guaranteed to exist as runtime custom properties — `ChartConfig.color` is typed to require this `var(--qb-chart-*)` form.

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
