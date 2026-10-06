# Dashboard UI

Why the redesigned dashboard surface (`apps/web/src/features/dashboard`) renders what it renders.
Metric definitions and query shapes live in `docs/DASHBOARD_METRICS.md`; this file covers
presentation, the shared chart package, accessibility and responsive rules, and the verification
practice this redesign introduced.

## Page composition

`dashboard-page.tsx` renders, in order, inside a single lifted `period` state (`useState<DashboardPeriod>(7)`):

1. `DashboardHeader` — subtitle and a period dropdown (7, 30 or 90 days).
2. `KpiStrip` — 4 `KpiStatCard`s (executed cases, runs, failed cases, failed runs), each with a
   mini area chart and a trend against the previous window.
3. `PassRateHero` — full-width executed-cases comparison chart (see "The hero shows executed
   cases" below).
4. A `@3xl:grid-cols-3` row: `ProjectsTable` (`col-span-2`) and `CasesGaugeCard`, the case-priority
   donut.
5. A `@3xl:grid-cols-2` row: `ChannelsCard` and `ActivityCard`.

Both two-column rows live inside their own `max-w-dashboard` (`--container-dashboard: 1128px`, a
`@theme` token, never `max-w-[1128px]`) wrapper and stack to a single column below their own
`@3xl` container breakpoint — the breakpoint is keyed to the row's own width, not the viewport, so
a row narrows correctly regardless of what else is on the page. Every grid child carries `min-w-0`,
because `ResponsiveContainer` (Recharts) cannot shrink a flex/grid child below its content size
without it.

Every widget manages its own `isLoading`/`isError`/`retry` independently — a failed
`GET /dashboard/channels` only degrades the channels card, never the KPI strip, the hero, the projects
table, the gauge or the activity card, which all read from `GET /dashboard/overview`.

## Where the dashboard blocks come from

Two sets of chart code exist side by side: `apps/web` draws its charts with its own primitives, and
`@qably/ui` ships the presentational blocks around them.

`apps/web/src/components/charts` holds the area, bar, line and pie chart primitives, with a tooltip
and a legend, vendored from bklit. `KpiStrip` draws its four cards with `KpiStatCard`
(`components/ui/kpi-stat-card.tsx`), `PassRateHero` uses `AreaChart`, and `CasesGaugeCard` uses
`PieChart` with a `Legend`.

`packages/ui/src/dashboard/` holds the presentational components: `Sparkline` (compact area chart),
`Gauge` (half-donut), `PassRateBar`, `DeliveryBars` (per-channel 14-day bar strip), `ChartDataTable`
(the `sr-only` mirror table), `KpiTile`, `StatusChip`, `Link`, `ChannelStat` and `ActivityEntryRow`.
The dashboard consumes `ActivityEntryRow` (and the `StatusChip` inside it), `ChannelStat`,
`ChartDataTable`, `DeliveryBars` and `PassRateBar`; `Sparkline`, `Gauge` and `KpiTile` are still in the
package but no app renders them. The components take data and copy through props and know nothing
about react-query, Next.js or the i18n store — `apps/web` wraps them in containers that fetch real
data and translate labels. `apps/landing` does not render this package's components: it imports only
the `KpiDeltaTone` type and keeps its own copies of the dashboard components for its preview.

`packages/ui/src/chart/chart.tsx` is a hand-vendored copy of shadcn/ui's `chart` primitive
(`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
`ChartStyle`, `ChartConfig`) over Recharts 3.8.1, rewritten so it speaks only this package's
`qb-*` token contract instead of shadcn's own `muted-foreground`/`background`/`border` class names
— those collide with names this repo already uses for other things. `Sparkline` and `Gauge` are built
on it, and no app uses it directly. There is no `components.json` in `packages/ui`; the file was
copied and adapted by hand rather than run through the shadcn CLI, because `apps/web/components.json`
targets a different style base and icon library (lucide, banned in this repo) that the CLI would
otherwise re-apply here.

### `ChannelStat`: a number over its label, not a sentence

`ChannelStat` renders one channel metric (sent/failed/unread) as a value-over-unit visual stack,
with the full sentence available to assistive tech only: the value and unit sit in an
`aria-hidden="true"` span pair (value in `font-mono tabular-nums`, unit in a smaller muted line
under it), and a sibling `.sr-only` span carries the plural-correct phrase a screen reader announces
instead (`"3 sent"`, `"1 failed"`). A `tone` prop (`default | muted | pass | fail`) maps to the
matching `qb-*` text colour — `apps/web`'s `channel-row.tsx`/`channels-card.tsx` pass `fail` when a
channel's failed count is greater than zero and `pass` otherwise. They render the stats inside an
`sr-only` wrapper: the visible row shows the `DeliveryBars` strip and a "Connected" status, and the
sent, failed and unread counts reach screen readers only. `apps/web` resolves `unit`/`srText` through
i18n (`dashboard.channels{Sent,Failed,Unread}Unit_one/_other` for the unit); the component itself never
calls `t()`.

### `ActivityEntryRow`: one row per commit or per standalone run

`ActivityEntryRow` is the shared presentational row behind `ActivityCard`, driven by a discriminated
union (`kind: 'commit' | 'run'`) matching `DashboardActivityEntry` from `@qably/types` (see
`docs/DASHBOARD_METRICS.md` for how the API groups runs into one entry per commit). A `commit` row
shows the project name, the 7-character short SHA (`commitSha.slice(0, 7)`, pure formatting done in
the component, not through i18n) in `font-mono` with the full SHA in `title` for hover/focus
disclosure, and a truncated commit message (also carrying its full text in `title` so a long message
is still readable). A `run` row shows `projectName · runName` instead, with no commit line. Both
kinds share a `StatusChip` (this package's own, not `apps/web`'s legacy `@/components/ui/status-chip`
— `apps/web`'s `activity-row.tsx` container resolves the chip's `label` through
`getLegacyStatusPresentation` for copy parity with the rest of the app), a `<time dateTime>` element
for the relative timestamp, and a `casesSummary` string the container pre-formats (suite/case counts
run through `formatEventCount(value, locale)` for locale-aware thousand separators — real
organizations report suite counts and case totals in the hundreds per push).

Like every other block in this package, `ActivityEntryRow` owns no icon assets: `sourceIcon` and the
optional `commitIcon` are `ReactNode` slots the web container fills (a GitHub Actions icon, a
`next/image` logo) so the shared component never imports `next/image` or a specific icon library.

In `@qably/ui/chart`, `ChartContainer` always forwards `initialDimension` — pass the chart's intrinsic
design size, not a guess. Recharts 3.8.1's `ResponsiveContainer` skips measuring entirely when
`ResizeObserver` is `undefined` (true in most test environments and on first paint before layout settles) and renders
at `initialDimension` instead of the historical `-1×-1` fallback that produced sizing warnings.
Passing the real intrinsic size means the chart is never invisible on first paint or inside a test.

### Token contract

Every block speaks only Tailwind `qb-*` utilities (`--color-qb-*`, declared in each app's `@theme
inline`) and, for charts, raw `--qb-chart-*` CSS variables read directly (`stroke="var(--qb-chart-line)"`,
or as a `ChartConfig` series `color` — `ChartConfig.color` is typed as `` `var(--qb-chart-${string})` ``
so a raw hex/oklch value fails to compile). `apps/web/src/app/globals.css` binds the `--color-qb-*`
names and declares the `--qb-chart-*` variables in its light OKLCH tokens;
`apps/landing/src/styles/global.css` declares only the `--qb-chart-*` variables and binds no
`--color-qb-*` names, because the landing app does not render this package's components. The two token
files are separate systems — never copy a value from one into the other. Both apps
`@source packages/ui/src` so Tailwind generates the package's utility classes.

`--qb-chart-compare` is the muted "previous period" series colour: the hero draws its dashed previous
series with it, and `Sparkline`'s `muted` tone reads it. It is a package contract var like the others,
not a web-local token, and each app declares its own value in its own token file.

### Runs hover token

The runs screens (the CI run rows, the suite rows and passing-suites bar of a CI run, the Manual
rows and their Load more button) hover on `--runs-hover`, `oklch(0.935 0 0)`, exposed as
`bg-runs-hover`. It has no chroma because `--surface-hover` is `oklch(0.935 0.008 260)`, a blue-tinted
grey the runs screens do not want.

`--surface-hover`, `--bg`, `--bg-sidebar-hover`, `--bg-sidebar-active` and `--heatmap-l0` belong to the
Dashboard, and so does every alias that reads them (`--chart-segment-background` and the `--color-*`
and `--color-qb-*` bindings), so none of them can change to suit the runs screens. Runs read their own
token instead. `apps/web/src/test/tokens.test.ts` pins the five values and the full alias list.

Rows apply the token at 60% (`hover:bg-runs-hover/60`), the same weight they had on `--surface-hover`,
so the page background `--bg` shows through at 40% and the rendered row keeps a trace of its tint.

## Accessibility contract

The dashboard charts follow two rules:

1. **An `sr-only` data table mirrors the chart.** `ChartDataTable` renders a real `<table>` with a
   `<caption>`, one column per series, `sr-only` so it is never visible but always in the
   accessibility tree — a screen reader gets the same date/value pairs a sighted reader gets from
   the plotted line or bar. The hero and `DeliveryBars` render one next to the plot, and so do the
   charts of the project quality page. The KPI cards give their chart an `aria-label` instead, and
   the priority donut is a `role="img"` with an `aria-label`.
2. **A value that was not measured is not drawn as zero.** See the meter contract below. The hero and
   the KPI cards plot daily counts, so a day with no runs is a real zero there.

The charts in `apps/web/src/components/charts` are pointer-driven: they handle mouse hover and touch,
and register no keyboard handler and no focusable chart root. The `sr-only` data table is the only way
to read the plotted values without a pointer, so keyboard users depend on it.

`Gauge` and `PassRateBar` additionally carry a proper meter contract: when their value is a real
number they render `role="meter"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext`;
when the value is `null` (not measured) they fall back to `role="img"` with just an `aria-label`,
because a meter with no value to report is a contradiction — there is nothing to measure against a
min/max.

### Touch input

The charts in `apps/web/src/components/charts` handle touch themselves (`use-chart-interaction.ts`):
one finger moves the tooltip along the series and two fingers select a range. The plot sets
`touch-action: none`, so a vertical swipe that starts on a chart does not scroll the page.

`useCoarsePointer()` (`@qably/ui/chart`, a `useSyncExternalStore` wrapper over
`matchMedia('(pointer: coarse)')`) is exported to switch a Recharts tooltip trigger between `'hover'`
and `'click'`, because Recharts 3.8.1 only dispatches its touch handling on `touchmove`. No component
uses it today.

## Responsive rules, verified at 390px

- KPI cards: 1 column by default, 2 columns from the strip's own `@xs` container breakpoint (not
  `@md` — a 390px viewport produces roughly a 350px container width once page padding is
  subtracted, which only clears `@xs`), 4 columns from `@2xl`.
- `KpiTile` (in `@qably/ui`, not rendered by any app today) is itself a `@container`: it stacks its
  value/label above its sparkline below 220px of its own width and goes side-by-side above that.
- Both `@3xl` two-column rows (projects/gauge, channels/activity) stack to one column below their
  own `@3xl`.
- The projects table is `table-fixed w-full` with the Suites and Cases columns
  (`hidden @lg:table-cell`) dropped below its own `@lg` container breakpoint and the Pass rate column
  pinned to a fixed width, rather than scrolling horizontally — a fixed layout that hides secondary
  columns keeps every visible row's data legible at narrow widths instead of clipping the card's
  `overflow-hidden` boundary or requiring a horizontal drag to see the pass rate. An earlier version
  used a horizontally scrollable region (`tabIndex={0}`, `role="region"`) with a `min-w-xl` table;
  dropped in favour of the fixed layout because a scroll-only-if-you-know-to-drag pattern is worse
  than showing fewer columns outright on a table this narrow.
- Channel rows keep one three-column grid (identity, delivery bars, status) at every width, and the
  identity column truncates (`min-w-0`).
- Each channel's sent/failed/unread counts are `ChannelStat`s (`@qably/ui/dashboard`) inside an
  `sr-only` wrapper, so screen readers get the plural-correct sentence while the visible row shows the
  delivery bars and the connected status.
- `ActivityCard` groups the window's runs into one row per commit (or per standalone run) via
  `ActivityEntryRow` (`@qably/ui/dashboard`) — see `docs/DASHBOARD_METRICS.md`'s `recentActivity`
  section for the grouping and status-precedence rules behind what each row shows.
- Every interactive control meets the 24×24px minimum target size.

The 390px gate — no horizontal `scrollWidth` overflow, hero tooltip opens on tap, horizontal drag
scrubs it, the projects table fits its card without scrolling — is
verified manually (Chrome device mode at 390×844, plus one real phone when available) and recorded
in the change's apply-progress. jsdom tests cover the same structural rules
(`min-w-0`, `role="region"`, no `max-w-[1128px]` arbitrary values, loading/empty/error states) but
cannot substitute for an actual narrow-viewport render.

## Real-browser verification is part of done

jsdom alone missed a real defect during this redesign: the hero rendered as a 0×0 box in a real
browser while every jsdom test for the same component passed, because jsdom never triggers the
`ResizeObserver`/layout path that exposed the bug. Every UI unit in this redesign is now also
checked in a real browser before being considered finished: a temporary harness route seeded with
realistic data, Playwright screenshots taken at 1440×900 and 390×844, compared against the approved
mockup, and the harness route deleted afterwards (`git status --porcelain` confirms nothing leaks
into the committed tree). This does not replace the jsdom/vitest suite — it catches the class of
bug jsdom structurally cannot.

## Deviations from the original spec, evaluated and accepted

- **The hero shows executed cases, not pass rate.** The original spec described the hero as a pass-rate
  comparison chart and the KPI strip as pass rate, runs, failed cases and average run duration. The
  hero was changed to a two-line "executed cases" comparison (current period solid, previous period
  dashed, both real zeros on no-run days rather than connected gaps) with a tooltip breaking each day
  down into passed/failed/blocked and a footer trend against the previous period, and the strip shows
  executed cases, runs, failed cases and failed runs. This is a deliberate, approved deviation from the
  spec text, not an oversight.
- **Project monograms are neutral, not a deterministic per-id color hash.** The spec asked for a
  monogram colour derived from a hash of the project id. Shipped, `project-monogram.tsx` renders a
  plain neutral badge (`bg-canvas-hover`/`text-default`) with the project's initials; the per-row
  `PassRateBar` already carries the value-driven semantic colour (pass/warn) for that row, and a
  second, unrelated colour signal on the monogram itself tested as visual noise rather than useful
  information. `monogram-tone.ts` was removed rather than kept unused.
- **The hero's debounced `aria-live` announcer was not ported** when the hero was rewritten for
  executed cases. The `sr-only` data table covers the assistive-technology path; a live-region
  announcement on every point change was judged a WARNING-level nice-to-have, not a blocking gap, but
  it has not yet had a manual screen-reader spot check.

See `docs/design/2026-09-22-dashboard-redesign.md`'s "Implementation notes" section for the full
list of where the shipped dashboard differs from the original brief, including the two backend
additions (the Qably in-app channel and email delivery tracking) that are not UI decisions but do
appear on this page.
