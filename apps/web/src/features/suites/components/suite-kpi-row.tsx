'use client'

/**
 * SuiteKpiRow — 4 KPI cards summarising the project's suite health.
 *
 * Reuses the global `KpiCard` from `@/components/ui/kpi-card` to stay
 * consistent with the dashboard's KPI row pattern.
 */
import { TestTube, ListChecks, ChartBar, Clock } from '@phosphor-icons/react'
import { KpiCard } from '@/components/ui/kpi-card'
import { useSuiteMetrics } from '@/features/suites/hooks/use-suite-metrics'
import { useTranslation } from '@/lib/i18n'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelative(iso: string | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

export function SuiteKpiRow({ projectId }: { projectId: string }) {
  const { projectMetrics } = useSuiteMetrics(projectId)
  const { totalSuites, totalCases, passRate7d, lastRunAt } = projectMetrics
  const { t } = useTranslation()

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
        value={formatRelative(lastRunAt)}
        icon={Clock}
        accent="default"
        subtext={lastRunAt ? undefined : t('suites.noRunsSubtext')}
      />
    </div>
  )
}
