import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardOverviewRecord } from '@qably/types'
import { en, es } from '@qably/i18n'
import { useI18nStore } from '@/lib/i18n/store'
import {
  dashboardOverviewFixture,
  emptyDashboardOverviewFixture,
} from '@/test/dashboard-api-stub'
import {
  buildStatisticsReport,
  statisticsPdfFileName,
  type BuildStatisticsReportOptions,
} from '@/features/statistics-pdf/lib/build-statistics-report'

const GENERATED_AT = new Date('2026-06-17T15:30:00.000Z')

function options(overrides: Partial<BuildStatisticsReportOptions> = {}): BuildStatisticsReportOptions {
  const { t } = useI18nStore.getState()
  return {
    scope: 'organization',
    period: 30,
    generatedAt: GENERATED_AT,
    locale: 'en',
    t,
    ...overrides,
  }
}

function row<T extends { label: string }>(rows: readonly T[], label: string): T {
  const found = rows.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`row "${label}" not found in ${rows.map((r) => r.label).join(', ')}`)
  return found
}

describe('buildStatisticsReport', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('titles the report and describes its scope, period and generation time', () => {
    const report = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(report.title).toBe('Qably — Quality statistics report')
    expect(report.meta).toEqual([
      { label: 'Scope', value: 'All projects' },
      { label: 'Period', value: 'Last 30 days (Jun 13, 2026 – Jun 16, 2026)' },
      { label: 'Generated', value: 'June 17, 2026 at 9:30 AM' },
      { label: 'Time zone', value: 'America/Guatemala' },
    ])
  })

  it('names the project when the report is scoped to one', () => {
    const report = buildStatisticsReport(
      dashboardOverviewFixture,
      options({ scope: 'project', projectName: 'Checkout Web' }),
    )

    expect(report.meta[0]).toEqual({ label: 'Scope', value: 'Checkout Web' })
    expect(report.projects).toBeNull()
  })

  it('formats every KPI with its previous value and a signed change', () => {
    const { kpis } = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(kpis.columns).toEqual(['Metric', 'Selected period', 'Previous period', 'Change'])
    expect(row(kpis.rows, 'Pass rate')).toEqual({
      label: 'Pass rate',
      current: '82%',
      previous: '75%',
      change: '+7 pts',
      tone: 'better',
    })
    expect(row(kpis.rows, 'Runs')).toMatchObject({ current: '42', previous: '35', change: '+7', tone: 'better' })
    expect(row(kpis.rows, 'Failed cases')).toMatchObject({ current: '6', previous: '9', change: '-3', tone: 'better' })
    expect(row(kpis.rows, 'Avg run duration')).toMatchObject({
      current: '3m 4s',
      previous: '3m 31s',
      change: '-27s',
      tone: 'better',
    })
    expect(row(kpis.rows, 'Executed cases')).toMatchObject({ current: '75', previous: '90', change: '-15' })
  })

  it('prints "Not measured" instead of 0% when a pass rate is null, and no change', () => {
    const { kpis } = buildStatisticsReport(emptyDashboardOverviewFixture, options({ period: 7 }))
    const passRate = row(kpis.rows, 'Pass rate')

    expect(passRate.current).toBe('Not measured')
    expect(passRate.previous).toBe('Not measured')
    expect(passRate.change).toBe('—')
    expect(passRate.tone).toBe('neutral')
    expect(JSON.stringify(kpis)).not.toContain('0%')
  })

  it('lists the pass-rate trend per bucket with a bar ratio, leaving unmeasured days without a bar', () => {
    const { trend } = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(trend.columns).toEqual(['Day', 'Pass rate', 'Previous period', 'Executed', 'Failed'])
    expect(trend.rows).toHaveLength(4)
    expect(trend.rows[0]).toEqual({
      label: 'Jun 13',
      passRate: '80%',
      ratio: 0.8,
      previous: '70%',
      executed: '25',
      failed: '4',
    })
    expect(trend.rows[2]).toMatchObject({ passRate: 'Not measured', ratio: null, previous: 'Not measured' })
    expect(trend.emptyText).toBeNull()
  })

  it('labels weekly buckets with the range they cover', () => {
    const weekly: DashboardOverviewRecord = {
      ...dashboardOverviewFixture,
      period: 90,
      passRateSeries: {
        granularity: 'week',
        current: [
          { date: '2026-06-01', rangeEnd: '2026-06-07', passRate: 0.5, runs: 2, failedRuns: 1, executed: 10, passed: 5, failed: 5, blocked: 0 },
        ],
        previous: [],
      },
    }

    const { trend } = buildStatisticsReport(weekly, options({ period: 90 }))

    expect(trend.columns[0]).toBe('Week')
    expect(trend.rows[0]).toMatchObject({ label: '1–Jun 7', previous: 'Not measured' })
  })

  it('explains an empty trend instead of drawing empty rows', () => {
    const { trend } = buildStatisticsReport(emptyDashboardOverviewFixture, options({ period: 7 }))

    expect(trend.rows).toEqual([])
    expect(trend.emptyText).toBe('No runs were recorded in this period.')
  })

  it('reports case outcomes with their share and the executed percentage', () => {
    const { cases } = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(row(cases.rows, 'Passed')).toEqual({ label: 'Passed', count: '98', share: '82%' })
    expect(row(cases.rows, 'Failed')).toMatchObject({ count: '12', share: '10%' })
    expect(row(cases.rows, 'Blocked')).toMatchObject({ count: '5', share: '4%' })
    expect(row(cases.rows, 'Skipped')).toMatchObject({ count: '5', share: '4%' })
    expect(row(cases.rows, 'Not executed')).toMatchObject({ count: '0', share: '0%' })
    expect(cases.summary).toBe('120 of 120 cases executed (100%). Pass rate: 85%.')
  })

  it('reports case priorities with their share of the active library', () => {
    const { priorities } = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(priorities.rows.map((r) => [r.label, r.count, r.share])).toEqual([
      ['Critical', '6', '15%'],
      ['High priority', '14', '35%'],
      ['Medium', '15', '38%'],
      ['Low', '5', '13%'],
    ])
  })

  it('never divides by zero when nothing was recorded', () => {
    const { cases, priorities } = buildStatisticsReport(emptyDashboardOverviewFixture, options({ period: 7 }))

    expect(cases.rows.every((r) => r.share === '—')).toBe(true)
    expect(cases.summary).toBe('No finished runs yet, so no case outcome was recorded.')
    expect(priorities.rows.every((r) => r.share === '—')).toBe(true)
  })

  it('lists every project for the organization scope, without coercing a null pass rate', () => {
    const { projects } = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(projects?.columns).toEqual(['Project', 'Suites', 'Cases', 'Pass rate', 'Last run'])
    expect(projects?.rows).toEqual([
      { name: 'Checkout Web', suites: '3', cases: '40', passRate: '82%', lastRun: 'Jun 16, 2026' },
      { name: 'Mobile App', suites: '2', cases: '18', passRate: '45%', lastRun: 'Jun 15, 2026' },
      { name: 'Internal Tools', suites: '1', cases: '0', passRate: 'Not measured', lastRun: 'No runs yet' },
    ])
  })

  it('writes the whole report in Spanish with Spanish number grouping', () => {
    useI18nStore.setState({ locale: 'es' })
    const big: DashboardOverviewRecord = {
      ...dashboardOverviewFixture,
      kpis: { ...dashboardOverviewFixture.kpis, runs: { value: 12345, previous: 10000, series: [] } },
    }

    const report = buildStatisticsReport(big, options({ locale: 'es', t: useI18nStore.getState().t }))

    expect(report.title).toBe('Qably — Reporte de estadísticas de calidad')
    expect(report.meta[1]).toEqual({ label: 'Periodo', value: 'Últimos 30 días (13 jun 2026 – 16 jun 2026)' })
    expect(row(report.kpis.rows, 'Ejecuciones')).toMatchObject({ current: '12,345', change: '+2,345' })
    expect(row(report.kpis.rows, 'Tasa de éxito').current).toBe('82%')
  })

  it('carries the footer, legend and page label for the document', () => {
    const report = buildStatisticsReport(dashboardOverviewFixture, options())

    expect(report.footer).toBe('Qably · Quality statistics report')
    expect(report.pageLabel).toBe('Page {page} of {total}')
    expect(report.notes.length).toBeGreaterThan(0)
  })
})

describe('statisticsPdfFileName', () => {
  it('slugs the organization scope, period and generation day in the record time zone', () => {
    expect(
      statisticsPdfFileName({ scope: 'organization', period: 30, generatedAt: GENERATED_AT, timeZone: 'America/Guatemala' }),
    ).toBe('qably-statistics-all-projects-30d-2026-06-17.pdf')
  })

  it('slugs a project name without accents or symbols', () => {
    expect(
      statisticsPdfFileName({
        scope: 'project',
        projectName: 'Pagos & Facturación  Móvil',
        period: 7,
        generatedAt: new Date('2026-06-17T03:00:00.000Z'),
        timeZone: 'America/Guatemala',
      }),
    ).toBe('qably-statistics-pagos-facturacion-movil-7d-2026-06-16.pdf')
  })

  it('falls back to a generic slug when the project name has no usable characters', () => {
    expect(
      statisticsPdfFileName({ scope: 'project', projectName: '***', period: 90, generatedAt: GENERATED_AT, timeZone: 'UTC' }),
    ).toBe('qably-statistics-project-90d-2026-06-17.pdf')
  })
})

function keyPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof nested === 'object' && nested !== null
      ? keyPaths(nested as Record<string, unknown>, path)
      : [path]
  })
}

describe('statistics PDF i18n parity', () => {
  it('keeps the statisticsPdf translation keys in parity between English and Spanish', () => {
    expect(keyPaths(es.statisticsPdf).sort()).toEqual(keyPaths(en.statisticsPdf).sort())
  })
})
