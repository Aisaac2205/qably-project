import type {
  CasePriorityCounts,
  DailyPoint,
  DashboardOverviewKpis,
  DashboardOverviewRecord,
  DashboardPeriod,
} from '@qably/types'
import type { Locale } from '@/lib/i18n'
import { resolveNumberLocale } from '@/lib/i18n'
import { formatRunDuration } from '@/features/dashboard/lib/format'
import { DASHBOARD_KPI_POLARITY, type KpiPolarity } from '@/features/dashboard/lib/kpi-delta'
import { formatSeriesRange, parseSeriesDate } from '@/features/dashboard/lib/series-date'

export type StatisticsScope = 'organization' | 'project'

export type Translate = (key: string, params?: Record<string, string | number>) => string

export interface BuildStatisticsReportOptions {
  readonly scope: StatisticsScope
  readonly projectName?: string
  readonly period: DashboardPeriod
  readonly generatedAt: Date
  readonly locale: Locale
  readonly t: Translate
}

export type ChangeTone = 'better' | 'worse' | 'neutral'

export interface ReportMetaEntry {
  readonly label: string
  readonly value: string
}

export interface ReportKpiRow {
  readonly label: string
  readonly current: string
  readonly previous: string
  readonly change: string
  readonly tone: ChangeTone
}

export interface ReportTrendRow {
  readonly label: string
  readonly passRate: string
  /** Pass rate as a 0–1 ratio for the bar, or null when the bucket was not measured. */
  readonly ratio: number | null
  readonly previous: string
  readonly executed: string
  readonly failed: string
}

export interface ReportCountRow {
  readonly label: string
  readonly count: string
  readonly share: string
}

export interface ReportProjectRow {
  readonly name: string
  readonly suites: string
  readonly cases: string
  readonly passRate: string
  readonly lastRun: string
}

/** Plain, fully formatted view model of the statistics PDF. No raw numbers leak to the renderer except bar ratios. */
export interface StatisticsReport {
  /** Document language, written into the PDF metadata for assistive technology. */
  readonly language: Locale
  readonly title: string
  readonly meta: readonly ReportMetaEntry[]
  readonly kpis: {
    readonly heading: string
    readonly columns: readonly string[]
    readonly rows: readonly ReportKpiRow[]
  }
  readonly trend: {
    readonly heading: string
    readonly columns: readonly string[]
    readonly rows: readonly ReportTrendRow[]
    readonly emptyText: string | null
  }
  readonly cases: {
    readonly heading: string
    readonly description: string
    readonly columns: readonly string[]
    readonly rows: readonly ReportCountRow[]
    readonly summary: string
  }
  readonly priorities: {
    readonly heading: string
    readonly description: string
    readonly columns: readonly string[]
    readonly rows: readonly ReportCountRow[]
  }
  readonly projects: {
    readonly heading: string
    readonly columns: readonly string[]
    readonly rows: readonly ReportProjectRow[]
  } | null
  readonly notes: readonly string[]
  readonly footer: string
  /** Page label with `{page}` and `{total}` placeholders, filled in by the renderer. */
  readonly pageLabel: string
}

const NO_CHANGE = '—'

const DATE_LOCALE_TAG: Record<Locale, string> = { en: 'en-US', es: 'es-ES' }

/**
 * Intl output can contain narrow no-break spaces (e.g. before "AM") that the
 * embedded PDF fonts may not carry a glyph for. A plain space reads the same.
 */
function normalizeSpaces(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return 'UTC'
  }
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function share(count: number, total: number): string {
  return total > 0 ? percent(count / total) : NO_CHANGE
}

function toneFor(diff: number, polarity: KpiPolarity): ChangeTone {
  if (diff === 0) return 'neutral'
  const better = polarity === 'higher-is-better' ? diff > 0 : diff < 0
  return better ? 'better' : 'worse'
}

function sum(points: readonly DailyPoint[], pick: (point: DailyPoint) => number): number {
  return points.reduce((total, point) => total + pick(point), 0)
}

export function buildStatisticsReport(
  record: DashboardOverviewRecord,
  options: BuildStatisticsReportOptions,
): StatisticsReport {
  const { t, locale, period } = options
  const timeZone = safeTimeZone(record.timeZone)
  const dateTag = DATE_LOCALE_TAG[locale] ?? DATE_LOCALE_TAG.en
  const numberFormat = new Intl.NumberFormat(resolveNumberLocale(locale))
  const signedFormat = new Intl.NumberFormat(resolveNumberLocale(locale), { signDisplay: 'exceptZero' })
  const notMeasured = t('statisticsPdf.notMeasured')

  const count = (value: number) => numberFormat.format(value)
  const rate = (value: number | null) => (value === null ? notMeasured : percent(value))

  // --- Header -------------------------------------------------------------
  const scopeValue =
    options.scope === 'organization'
      ? t('statisticsPdf.scopeOrganization')
      : options.projectName?.trim() || t('statisticsPdf.scopeProjectFallback')

  const periodLabel = t('statisticsPdf.periodValue', { count: period })
  const current = record.passRateSeries.current
  const first = current[0]
  const last = current[current.length - 1]
  const mediumDate = new Intl.DateTimeFormat(dateTag, { dateStyle: 'medium' })
  const periodValue =
    first && last
      ? t('statisticsPdf.periodRange', {
          label: periodLabel,
          start: mediumDate.format(parseSeriesDate(first.date)),
          end: mediumDate.format(parseSeriesDate(last.rangeEnd)),
        })
      : periodLabel

  const generatedValue = new Intl.DateTimeFormat(dateTag, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(options.generatedAt)

  const meta: ReportMetaEntry[] = [
    { label: t('statisticsPdf.scopeLabel'), value: scopeValue },
    { label: t('statisticsPdf.periodLabel'), value: normalizeSpaces(periodValue) },
    { label: t('statisticsPdf.generatedAtLabel'), value: normalizeSpaces(generatedValue) },
    { label: t('statisticsPdf.timeZoneLabel'), value: timeZone },
  ]

  // --- KPIs ---------------------------------------------------------------
  const kpiRow = (
    metric: keyof DashboardOverviewKpis | 'executedCases',
    label: string,
    value: number | null,
    previous: number | null,
  ): ReportKpiRow => {
    const polarity: KpiPolarity =
      metric === 'executedCases' ? 'higher-is-better' : DASHBOARD_KPI_POLARITY[metric]
    const format = (v: number | null): string => {
      if (v === null) return notMeasured
      if (metric === 'passRate') return percent(v)
      if (metric === 'avgRunDurationMs') return formatRunDuration(v)
      return count(v)
    }

    if (value === null || previous === null) {
      return { label, current: format(value), previous: format(previous), change: NO_CHANGE, tone: 'neutral' }
    }

    let diff: number
    let change: string
    if (metric === 'passRate') {
      diff = Math.round(value * 100) - Math.round(previous * 100)
      change = t('statisticsPdf.changePoints', { value: signedFormat.format(diff) })
    } else if (metric === 'avgRunDurationMs') {
      diff = Math.round(value / 1000) - Math.round(previous / 1000)
      const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
      change = `${sign}${formatRunDuration(Math.abs(diff) * 1000)}`
    } else {
      diff = value - previous
      change = signedFormat.format(diff)
    }

    return { label, current: format(value), previous: format(previous), change, tone: toneFor(diff, polarity) }
  }

  const { kpis } = record
  const kpiRows: ReportKpiRow[] = [
    kpiRow('passRate', t('dashboard.kpiPassRateLabel'), kpis.passRate.value, kpis.passRate.previous),
    kpiRow(
      'executedCases',
      t('dashboard.kpiExecutedCasesLabel'),
      sum(current, (point) => point.executed),
      sum(record.passRateSeries.previous, (point) => point.executed),
    ),
    kpiRow('runs', t('dashboard.kpiRunsLabel'), kpis.runs.value, kpis.runs.previous),
    kpiRow('failedCases', t('dashboard.kpiFailedCasesLabel'), kpis.failedCases.value, kpis.failedCases.previous),
    kpiRow(
      'avgRunDurationMs',
      t('dashboard.kpiAvgDurationLabel'),
      kpis.avgRunDurationMs.value,
      kpis.avgRunDurationMs.previous,
    ),
  ]

  // --- Trend --------------------------------------------------------------
  const { granularity, previous: previousSeries } = record.passRateSeries
  const trendRows: ReportTrendRow[] = current.map((point, index) => ({
    label: normalizeSpaces(formatSeriesRange(point, granularity, locale)),
    passRate: rate(point.passRate),
    ratio: point.passRate,
    previous: rate(previousSeries[index]?.passRate ?? null),
    executed: count(point.executed),
    failed: count(point.failed),
  }))

  // --- Cases --------------------------------------------------------------
  const outcomes = record.casesPassing
  const notExecuted = outcomes.pending + outcomes.running
  const executed = Math.max(outcomes.total - notExecuted, 0)
  const measured = outcomes.pass + outcomes.fail + outcomes.blocked
  const caseRows: ReportCountRow[] = [
    { label: t('statisticsPdf.casesPassed'), value: outcomes.pass },
    { label: t('statisticsPdf.casesFailed'), value: outcomes.fail },
    { label: t('statisticsPdf.casesBlocked'), value: outcomes.blocked },
    { label: t('statisticsPdf.casesSkipped'), value: outcomes.skip },
    { label: t('statisticsPdf.casesNotExecuted'), value: notExecuted },
  ].map(({ label, value }) => ({ label, count: count(value), share: share(value, outcomes.total) }))

  const casesSummary =
    outcomes.total > 0
      ? t('statisticsPdf.casesSummary', {
          executed: count(executed),
          total: count(outcomes.total),
          percent: percent(executed / outcomes.total),
          passRate: measured > 0 ? percent(outcomes.pass / measured) : notMeasured,
        })
      : t('statisticsPdf.casesEmpty')

  // --- Priorities ---------------------------------------------------------
  const priorityKeys: { key: keyof CasePriorityCounts; label: string }[] = [
    { key: 'critical', label: t('dashboard.priorityCritical') },
    { key: 'high', label: t('dashboard.priorityHigh') },
    { key: 'medium', label: t('dashboard.priorityMedium') },
    { key: 'low', label: t('dashboard.priorityLow') },
  ]
  const priorityTotal = priorityKeys.reduce((total, { key }) => total + record.casePriorities[key], 0)
  const priorityRows: ReportCountRow[] = priorityKeys.map(({ key, label }) => ({
    label,
    count: count(record.casePriorities[key]),
    share: share(record.casePriorities[key], priorityTotal),
  }))

  // --- Projects -----------------------------------------------------------
  const lastRunFormat = new Intl.DateTimeFormat(dateTag, { dateStyle: 'medium', timeZone })
  const projects =
    options.scope === 'organization'
      ? {
          heading: t('statisticsPdf.projectsHeading'),
          columns: [
            t('dashboard.projectsColProject'),
            t('dashboard.projectsColSuites'),
            t('dashboard.projectsColCases'),
            t('dashboard.projectsColPassRate'),
            t('dashboard.projectsColLastRun'),
          ],
          rows: record.projects.map((project) => ({
            name: project.name,
            suites: count(project.suites),
            cases: count(project.cases),
            passRate: rate(project.passRate),
            lastRun: project.lastRunAt
              ? normalizeSpaces(lastRunFormat.format(new Date(project.lastRunAt)))
              : t('dashboard.noRuns'),
          })),
        }
      : null

  return {
    language: locale,
    title: t('statisticsPdf.documentTitle'),
    meta,
    kpis: {
      heading: t('statisticsPdf.kpiHeading'),
      columns: [
        t('statisticsPdf.kpiColMetric'),
        t('statisticsPdf.kpiColCurrent'),
        t('statisticsPdf.kpiColPrevious'),
        t('statisticsPdf.kpiColChange'),
      ],
      rows: kpiRows,
    },
    trend: {
      heading: t('statisticsPdf.trendHeading'),
      columns: [
        granularity === 'week' ? t('statisticsPdf.trendColWeek') : t('statisticsPdf.trendColDay'),
        t('statisticsPdf.trendColPassRate'),
        t('statisticsPdf.trendColPrevious'),
        t('statisticsPdf.trendColExecuted'),
        t('statisticsPdf.trendColFailed'),
      ],
      rows: trendRows,
      emptyText: trendRows.length === 0 ? t('statisticsPdf.trendEmpty') : null,
    },
    cases: {
      heading: t('statisticsPdf.casesHeading'),
      description: t('statisticsPdf.casesDescription'),
      columns: [
        t('statisticsPdf.casesColOutcome'),
        t('statisticsPdf.casesColCount'),
        t('statisticsPdf.casesColShare'),
      ],
      rows: caseRows,
      summary: casesSummary,
    },
    priorities: {
      heading: t('statisticsPdf.prioritiesHeading'),
      description: t('statisticsPdf.prioritiesDescription'),
      columns: [
        t('statisticsPdf.prioritiesColPriority'),
        t('statisticsPdf.casesColCount'),
        t('statisticsPdf.casesColShare'),
      ],
      rows: priorityRows,
    },
    projects,
    notes: [t('statisticsPdf.noteNotMeasured'), t('statisticsPdf.notePassRate')],
    footer: t('statisticsPdf.footer'),
    pageLabel: t('statisticsPdf.pageNumber', { page: '{page}', total: '{total}' }),
  }
}

export interface StatisticsPdfFileNameInput {
  readonly scope: StatisticsScope
  readonly projectName?: string
  readonly period: DashboardPeriod
  readonly generatedAt: Date
  readonly timeZone: string
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `qably-statistics-<scope-slug>-<period>d-<YYYY-MM-DD>.pdf`, dated in the report's time zone. */
export function statisticsPdfFileName(input: StatisticsPdfFileNameInput): string {
  const scopeSlug =
    input.scope === 'organization' ? 'all-projects' : slugify(input.projectName ?? '') || 'project'
  // en-CA formats a date as YYYY-MM-DD.
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: safeTimeZone(input.timeZone),
  }).format(input.generatedAt)

  return `qably-statistics-${scopeSlug}-${input.period}d-${day}.pdf`
}
