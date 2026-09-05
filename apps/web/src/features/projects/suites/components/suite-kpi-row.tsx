'use client'

/**
 * SuiteKpiRow — 4 KPI cards summarising the project's suite health.
 *
 * Reuses the global `KpiCard` from `@/components/ui/kpi-card` to stay
 * consistent with the dashboard's KPI row pattern.
 */
import { TestTube, ListChecks, ChartBar, Clock } from '@phosphor-icons/react'
import { KpiCard } from '@/components/ui/kpi-card'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

export function SuiteKpiRow({ projectId }: { projectId: string }) {
  const { projectMetrics } = useSuiteMetrics(projectId)
  const { totalSuites, totalCases, passRate7d, lastRunAt } = projectMetrics
  const { t, locale } = useTranslation()

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      role="group"
      aria-label={t('suites.projectSuiteHealth')}
    >
      <KpiCard
        label={t('suites.suitesLabel')}
        value={totalSuites}
        icon={TestTube}
        accent="primary"
        subtext={totalSuites === 0 ? t('suites.noSuitesSubtext') : t('suites.suitesInProject', { count: totalSuites })}
      />
      <KpiCard
        label={t('suites.testCasesLabel')}
        value={totalCases}
        icon={ListChecks}
        accent="running"
        subtext={t('suites.acrossAllSuites')}
      />
      <KpiCard
        label={t('suites.passRate7dLabel')}
        value={`${passRate7d}%`}
        icon={ChartBar}
        accent={passRate7d >= 70 ? 'pass' : passRate7d > 0 ? 'warn' : 'default'}
        subtext={t('suites.projectWide')}
      />
      <KpiCard
        label={t('suites.lastRunLabel')}
        value={formatRelative(lastRunAt, locale, '—')}
        icon={Clock}
        accent="default"
        subtext={lastRunAt ? undefined : t('suites.noRunsSubtext')}
      />
    </div>
  )
}
