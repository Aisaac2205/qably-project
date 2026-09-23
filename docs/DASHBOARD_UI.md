# Dashboard UI

Why the redesigned dashboard surface (`apps/web/src/features/dashboard`) renders what it renders.
Metric definitions and query shapes live in `docs/DASHBOARD_METRICS.md`; this file covers
presentation, the shared chart package, accessibility and responsive rules, and the verification
practice this redesign introduced.

## Page composition

`dashboard-page.tsx` renders, in order, inside a single lifted `period` state (`useState<DashboardPeriod>(30)`):

1. `DashboardHeader` — title, subtitle, period toggle (7/30/90).
2. `KpiStrip` — 4 `KpiTile`s (pass rate, runs, failed cases, avg run duration), each with a
   sparkline and a delta against the previous window.
3. `PassRateHero` — full-width executed-cases comparison chart (see "The hero shows executed
   cases" below).
4. A `@3xl:grid-cols-3` row: `ProjectsTable` (`col-span-2`) and `CasesGaugeCard`.
5. A `@3xl:grid-cols-2` row: `ChannelsCard` and `ActivityCard`.

Both two-column rows live inside their own `max-w-dashboard` (`--container-dashboard: 1128px`, a
`@theme` token, never `max-w-[1128px]`) wrapper and stack to a single column below their own
`@3xl` container breakpoint — the breakpoint is keyed to the row's own width, not the viewport, so
a row narrows correctly regardless of what else is on the page. Every grid child carries `min-w-0`,
because `ResponsiveContainer` (Recharts) cannot shrink a flex/grid child below its content size
without it.

Every widget manages its own `isLoading`/`isError`/`retry` independently — a failed
`GET /dashboard/channels` only degrades the channels and activity cards, never the KPI strip or the
hero, which read from `GET /dashboard/overview`.

## The dashboard blocks live in `@qably/ui`, built on a vendored shadcn chart

`packages/ui/src/chart/chart.tsx` is a hand-vendored copy of shadcn/ui's `chart` primitive
(`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
`ChartStyle`, `ChartConfig`) over Recharts 3.8.1, rewritten so it speaks only this package's
`qb-*` token contract instead of shadcn's own `muted-foreground`/`background`/`border` class names
— those collide with names this repo already uses for other things. There is no `components.json`
in `packages/ui`; the file was copied and adapted by hand rather than run through the shadcn CLI,
because `apps/web/components.json` targets a different style base and icon library (lucide, banned
in this repo) that the CLI would otherwise re-apply here.

`packages/ui/src/dashboard/` holds the presentational chart components built on that primitive:
`Sparkline` (compact area chart for KPI tiles), `Gauge` (the cases-passing donut), `PassRateBar`,
`DeliveryBars` (per-channel 14-day bar strip), `ChartDataTable` (the shared `sr-only` mirror table
every chart renders alongside itself), `KpiTile`, `StatusChip` and `Link`. They take data and copy
through props and know nothing about react-query, Next.js or the i18n store — `apps/web` wraps them
in containers that fetch real data and translate labels; `apps/landing`'s own dashboard preview
(`landing-dashboard-previews`, a separate change) will render the same components with demo data,
so the marketing preview is never a re-implementation of the product's charts.

`ChartContainer` always forwards `initialDimension` — pass the chart's intrinsic design size, not a
guess. Recharts 3.8.1's `ResponsiveContainer` skips measuring entirely when `ResizeObserver` is
`undefined` (true in most test environments and on first paint before layout settles) and renders
at `initialDimension` instead of the historical `-1×-1` fallback that produced sizing warnings.
Passing the real intrinsic size means the chart is never invisible on first paint or inside a test.

### Token contract

Every block speaks only Tailwind `qb-*` utilities (`--color-qb-*`, declared in each app's `@theme
inline`) and, for charts, raw `--qb-chart-*` CSS variables read directly (`stroke="var(--qb-chart-line)"`,
or as a `ChartConfig` series `color` — `ChartConfig.color` is typed as `` `var(--qb-chart-${string})` ``
so a raw hex/oklch value fails to compile). `apps/web/src/app/globals.css` binds them to its light
OKLCH tokens; `apps/landing/src/styles/global.css` binds them to its own dark hex/rgba mirror. The
two token files are separate systems — never copy a value from one into the other. Both apps
`@source packages/ui/src` so Tailwind generates the package's utility classes.

`--qb-chart-compare` is this redesign's one new package-level contract variable (bound to
`var(--fg-muted)` in `apps/web`): the muted, dashed "previous period" series colour used by the
hero and by `Sparkline`'s `muted` tone. It is a package contract var like the others, not a
web-local token — `apps/landing` will bind its own value when the landing preview change lands,
never copy `apps/web`'s.

## Accessibility contract

Every chart component satisfies the same three rules, independent of which one it is:

1. **An `sr-only` data table mirrors the chart.** `ChartDataTable` renders a real `<table>` with a
   `<caption>`, one column per series, `sr-only` so it is never visible but always in the
   accessibility tree — a screen reader gets the same date/value pairs a sighted reader gets from
   the plotted line or bar.
2. **Keyboard focus reveals the same content hover does.** The hero and any other Recharts-backed
   chart use Recharts 3's native `accessibilityLayer` (a focusable chart root, arrow keys move the
   active point) rather than a hand-rolled roving-tabindex overlay — one tooltip implementation
   serves mouse, touch and keyboard instead of three.
3. **A `null` point renders as a visual gap, never a drop to zero.** `Sparkline` and the hero both
   use `connectNulls={false}`/real gaps in the underlying series; a day with no runs is invisible on
   the line, not a dip to the axis.

`Gauge` and `PassRateBar` additionally carry a proper meter contract: when their value is a real
number they render `role="meter"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext`;
when the value is `null` (not measured) they fall back to `role="img"` with just an `aria-label`,
because a meter with no value to report is a contradiction — there is nothing to measure against a
min/max.

### Touch and coarse-pointer input

`useCoarsePointer()` (`@qably/ui/chart`, a `useSyncExternalStore` wrapper over
`matchMedia('(pointer: coarse)')`) decides whether a chart's tooltip trigger is `'hover'` or
`'click'`. Recharts 3.8.1 only dispatches its touch handling on `touchmove`, so a tap with no
movement would not reliably open a hover-triggered tooltip on a touch device; switching the trigger
to `'click'` on coarse pointers makes a tap open it every time. The plot itself gets
`touch-action: pan-y` (Tailwind's `touch-pan-y`) so vertical page scrolling still works over the
chart while a horizontal drag can still scrub it.

## Responsive rules, verified at 390px

- KPI cards: 1 column by default, 2 columns from the strip's own `@xs` container breakpoint (not
  `@md` — a 390px viewport produces roughly a 350px container width once page padding is
  subtracted, which only clears `@xs`), 4 columns from `@2xl`.
- `KpiTile` itself is a `@container`: it stacks its value/label above its sparkline below 220px of
  its own width and goes side-by-side above that, so a narrow 2-up tile on a small phone never
  overflows its sparkline into the tile next to it.
- Both `@3xl` two-column rows (projects/gauge, channels/activity) stack to one column below their
  own `@3xl`.
- The projects table lives inside its own horizontally scrollable region
  (`tabIndex={0}`, `role="region"`, `aria-label`) inside its card — the table can scroll, the page
  never does.
- Channel rows stack identity above delivery bars below `@md`.
- Every interactive control (the period toggle segments, sort buttons) meets the 24×24px minimum
  target size.

The 390px gate — no horizontal `scrollWidth` overflow, hero tooltip opens on tap, horizontal drag
scrubs it, vertical swipe still scrolls the page, the table scrolls inside its own card — is
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
  comparison chart. The pass rate KPI tile already covers that number, so the hero was changed to a
  two-line "executed cases" comparison (current period solid, previous period dashed, both real
  zeros on no-run days rather than connected gaps) with a tooltip breaking each day down into
  passed/failed/blocked and a footer trend against the previous period. This is a deliberate,
  approved deviation from the spec text, not an oversight.
- **Project monograms are neutral, not a deterministic per-id color hash.** The spec asked for a
  monogram colour derived from a hash of the project id. Shipped, `project-monogram.tsx` renders a
  plain neutral badge (`bg-canvas-hover`/`text-default`) with the project's initials; the per-row
  `PassRateBar` already carries the value-driven semantic colour (pass/warn) for that row, and a
  second, unrelated colour signal on the monogram itself tested as visual noise rather than useful
  information. `monogram-tone.ts` was removed rather than kept unused.
- **The hero's debounced `aria-live` announcer was not ported** when the hero was rewritten for
  executed cases. Recharts' `accessibilityLayer` plus the `sr-only` data table cover the same
  keyboard/assistive-technology path; a live-region announcement on every arrow-key move was judged
  a WARNING-level nice-to-have, not a blocking gap, but it has not yet had a manual screen-reader
  spot check.

See `docs/design/2026-09-22-dashboard-redesign.md`'s "Implementation notes" section for the full
list of where the shipped dashboard differs from the original brief, including the two backend
additions (the Qably in-app channel and email delivery tracking) that are not UI decisions but do
appear on this page.
