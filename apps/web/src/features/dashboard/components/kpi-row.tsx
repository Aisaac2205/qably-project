'use client'

import Link from 'next/link'
import { Play, ChartBar, Sparkle, CircleNotch } from '@phosphor-icons/react'
import { KpiCard } from '@qably/ui/dashboard'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

export function KpiRow() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const detailsLabel = t('common.viewDetails')

  return (
    <section aria-label="Quality overview" className="min-w-0">
      <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.runsKpi')}
          value={stats.runsLast7d}
          icon={Play}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
        />
        <KpiCard
          label={t('dashboard.passRateKpi')}
          value={`${stats.passRateLast7d}%`}
          icon={ChartBar}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent={stats.passRateLast7d >= 80 ? 'pass' : stats.passRateLast7d >= 50 ? 'warn' : 'fail'}
          trend={{ value: stats.passRateTrend, label: t('dashboard.vsPrior7d'), isPercentage: true }}
        />
        <KpiCard
          label={t('dashboard.pendingAiKpi')}
          value={stats.pendingProposals}
          icon={Sparkle}
          href="/review-inbox"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent="ai"
        />
        <KpiCard
          label={t('dashboard.activeRunsKpi')}
          value={stats.activeRuns}
          icon={CircleNotch}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent={stats.activeRuns > 0 ? 'running' : 'default'}
        />
      </dl>
    </section>
  )
}
