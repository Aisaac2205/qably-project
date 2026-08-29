'use client'

import { Play, ChartBar, Sparkle, Target } from '@phosphor-icons/react'
import { KpiCard } from './kpi-card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

export function KpiRow() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  return (
    <section
      aria-label="Quality overview"
      className="min-w-0"
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.runsKpi')}
          value={stats.runsLast7d}
          icon={Play}
          href="/projects"
        />
        <KpiCard
          label={t('dashboard.passRateKpi')}
          value={`${stats.passRateLast7d}%`}
          icon={ChartBar}
          href="/projects"
          accent={stats.passRateLast7d >= 80 ? 'pass' : stats.passRateLast7d >= 50 ? 'warn' : 'fail'}
          trend={{
            value: stats.passRateTrend,
            label: t('dashboard.vsPrior7d'),
            isPercentage: true,
          }}
        />
        <KpiCard
          label={t('dashboard.pendingAiKpi')}
          value={stats.pendingProposals}
          icon={Sparkle}
          href="/review-inbox"
          accent="ai"
        />
        <KpiCard
          label={t('dashboard.coverageGapsKpi')}
          value={stats.coverageGapsCount}
          icon={Target}
          href="/projects"
          accent={stats.coverageGapsCount > 0 ? 'warn' : 'default'}
        />
      </dl>
    </section>
  )
}



