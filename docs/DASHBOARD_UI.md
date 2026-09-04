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
