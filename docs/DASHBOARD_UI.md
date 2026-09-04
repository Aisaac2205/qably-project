# Dashboard UI

Why the dashboard surface (`apps/web/src/features/dashboard`) renders what it renders. The metric
definitions and query shapes live in `docs/DASHBOARD_METRICS.md`; this file covers presentation
decisions that the code deliberately does not explain inline.

## Vocabulary

The dashboard is read by QA engineers and QA leads at Guatemalan software factories, working from
editors, terminals and CI. Labels follow, in order of precedence:

1. The terms the thesis already fixes (`CONTEXT.md` 4.1-4.4): *ejecución de prueba*, *conjunto de
   pruebas*, *caso de prueba*, *cobertura*, *trazabilidad*.
2. The ISTQB/SSTQB Spanish glossary, which the thesis cites as the standard for testing terms.
3. Microsoft Learn's Spanish Azure Test Plans documentation for metric names (*tasa de
   aprobación*), and GitHub's Spanish Actions documentation for CI terms (*ejecución de flujo de
   trabajo*, *trabajo*).

A label states what the panel lists, never a category the reader has to decode.

| Key | Spanish | English | Why |
| --- | --- | --- | --- |
| `dashboard.recentRuns` | Ejecuciones de prueba | Test runs | ISTQB's term for the unit being listed. "Recientes" said nothing the ordering did not. |
| `dashboard.ciCommits` | Commits en CI | Commits in CI | Each row is a commit, not a pipeline. See "Two queues, two granularities" below. |
| `dashboard.ciRunsPassed` | {{passed}}/{{total}} aprobadas | {{passed}}/{{total}} passed | Counts the commit's test runs. Server-computed over every run, see `docs/DASHBOARD_METRICS.md`. |
| `dashboard.workQueue` | Cola de trabajo | Work queue | Landmark name for the two-queue panel. Was hardcoded English. |
| `dashboard.projectStatus` | Estado de los proyectos | Project status | "Salud" is a project-management health-check metaphor, not a QA metric, and the table reports status. |
| `dashboard.thPassRate` | Tasa de aprobación | Pass rate | Microsoft Learn's Spanish Azure Test Plans term for this exact metric. |
| `common.viewDetails` / `common.noRecentChange` | Ver detalles / Sin cambios recientes | View details / No recent change | `KpiCard` hardcoded the Spanish strings while its screen-reader affordance hardcoded English, so both rendered at once. |

## Two queues, two granularities

The work-queue panel holds two lists that describe the same events at different levels, and the
naming has to make that hierarchy legible rather than look like duplication:

- **Ejecuciones de prueba** lists individual runs. One run is one test suite executed, which for
  CI-reported runs means one test file. It answers "what ran, and did it pass?".
- **Commits en CI** lists commits. It answers "which changes has CI checked, and what is their
  verdict?" — the correlation between a code change and its test evidence that `CONTEXT.md` 4.1.2
  names as the product's first objective.

The right-hand queue is grouped by commit rather than by CI workflow run. The reasoning, and why
the grouping cannot happen in the client, is in `docs/DASHBOARD_METRICS.md` under "Why CI activity
is grouped by commit".

## Row subtitles carry what the title does not

A queue row is a title, a subtitle and a status. The subtitle exists to add information, so it
never restates the title:

- **Test-run rows** previously showed the suite name as the subtitle. For CI-reported runs the run
  name is `"<workflow> / <suite> (#<number>)"`, so the suite name was already in the title and the
  subtitle read as a duplicate. The subtitle now shows how long ago the run started — which the row
  did not state at all before — and prepends the suite name only when the title does not already
  contain it.
- **Commit rows** show the short sha, the passed/total run count, and how long ago the last run
  started. The rolled-up status sits in the chip on the right.

## Counts are stated once

The traceability header states the year's event total in its heading. The stage selector used to
repeat that same total as a badge on its trigger, and with a different thousands separator, because
the heading formatted through `formatEventCount` while the badge fell through to a bare
`toLocaleString()`.

The trigger no longer carries a badge (`SelectSimple`'s `badgeInTrigger={false}`). The per-stage
badges stay inside the dropdown, where they are not a repetition: they let the reader compare stage
volumes before choosing one. All of them are formatted through `formatEventCount` with the active
locale.

## Time is localized

`formatRelativeTime` takes the active locale. It returns compact forms (`1h ago`, `hace 1 h`)
rather than going through `Intl.RelativeTimeFormat`, because the dashboard's number formatting is
already deliberately ICU-independent (see `formatEventCount`) and the compact form suits dense
operational rows. Beyond 30 days it falls back to a locale-appropriate absolute date.

## The project table reports status, and orders by what needs attention

`ProjectActivity.healthScore` is not a health score. `computeHealthScore` in
`apps/api/src/common/metrics/run-case-metrics.ts` returns `round(passRate * 100)` over the trailing
window: it is the pass rate, under a different name. The dashboard was showing that same number in
three places under three labels — the KPI card ("Aprobación · 7 días"), the trend card ("Tendencia
de aprobación") and the table's "Salud" column — which read as three metrics instead of one.

The UI now calls it the pass rate everywhere. The API field keeps its `healthScore` name because
renaming a contract field consumed by the projects page as well is a separate change; the
presentation layer is what the reader sees.

Two columns replace the old "Salud" column, because it was conflating two different facts:

- **Última ejecución** pairs the status chip of the most recent run with when that run started. A
  chip alone did not say whether it was from an hour ago or a month ago.
- **Tasa de aprobación** carries the windowed percentage, or "Aún sin medir" when the project has
  run but has nothing inside the window. `null` there means "not measured in this window" and is
  rendered differently from a real `0`.

Rows are ordered by how much attention they need rather than by insertion order: failing first,
then runs in flight, then measured projects by weakest pass rate, then projects whose window holds
no runs, then projects that have never run. The tie-break is the most recent run, then the name.
`CONTEXT.md` 4.1.4b states the table's job as giving the QA lead immediate visibility of each
project's real state without opening every suite, and an unordered list of every project does not
do that job.

## Columns appear when they have something to report

The Review/AI domain has no API module, and `projects.service.ts` deliberately omits
`aiPendingCount` rather than inventing a zero. The table therefore rendered a column of em dashes on
every row.

The AI column is now conditional: it is absent while no project reports a count, and appears on its
own as soon as one does. This keeps the surface honest today without discarding the contract, so
landing the Review/AI module requires no change here.

## The traceability calendar reads the database

`useTraceabilityCalendar` used to fabricate the whole year with `Math.sin()`-seeded
pseudo-randomness, overlay live store counts onto the single `MOCK_NOW` day, and take the displayed
year from `MOCK_NOW` rather than the clock. That is why one cell reported thousands of events and
why the calendar stopped in June.

It now fetches `GET /dashboard/traceability` (see `docs/DASHBOARD_METRICS.md`) and hands the record
to `buildTraceabilityGrid`, a pure function that lays the year out into week columns, pads the
first and last week with nulls rather than foreign days, and fills the days the server omitted with
zero. Handling the leap year and the month labels there keeps the component free of date logic.

### Intensity levels come from the data, not fixed cut points

The old thresholds were hardcoded at 3, 7 and 12 events. Real CI activity here is one run per test
file, so an ordinary day clears the top bucket and the whole year renders as one flat colour.

`computeLevelThresholds` takes the quartiles of the days that actually had activity, so the five
steps always describe the distribution being shown. The scale is recomputed per stage filter,
because a stage's volume is not comparable to the total.

## The heatmap encodes volume, so it uses the brand ink ramp

`--heatmap-l0` through `--heatmap-l4` did not exist. The calendar referenced them with a fallback,
so it always rendered the hardcoded `oklch()` literals in the fallback position, against the
project's tokens-only rule.

Those literals were GitHub's green, hue 145, which is also the hue of `--status-pass`. The heatmap
encodes event **volume**, not quality, so a day of thirty failing runs was painting itself in the
colour the rest of the product uses for "passed". The tokens now define a neutral ink ramp on the
brand's own hue, stepping about 0.15 in lightness between levels so adjacent cells stay
distinguishable.

Intensity is applied through `bg-heatmap-l*` utilities rather than inline styles, so the cells stay
inspectable and the palette lives in one place.

## The calendar is a real grid, not a picture

The calendar was an `<svg role="img">` whose `<rect>` children each carried `role="gridcell"`.
`role="img"` makes its entire subtree presentational, so those 365 cells did not exist for a screen
reader at all; and `gridcell` outside a `grid`/`row` is invalid ARIA regardless. The tooltip was
bound to `onMouseEnter` alone, so a keyboard user could not reach any of the per-day figures, and
the cell labels were hardcoded Spanish with no pluralisation ("1 eventos").

It is now a `<table role="grid">`: one row per weekday, one column per week, month names as
`columnheader`s spanning their weeks, and weekday names as `rowheader`s. All seven weekday headers
exist for assistive technology; only three are shown visually, the rest are `sr-only`, so the sparse
look survives without costing the row headers.

Keyboard access follows the APG grid pattern: one tab stop into the grid, then the arrow keys move
between days. Focus and hover both open the day summary, satisfying the requirement that
hover-revealed content also be reachable by keyboard. The tooltip itself is `aria-hidden`, because
the focused cell's own label already carries the same sentence and announcing it twice is worse
than not announcing it.

Day labels come from `describeDay`, shared by the tooltip and the cell labels, which picks the
singular, plural or empty phrasing from the active locale instead of formatting "1 eventos".
