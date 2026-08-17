'use client'

import { FolderOpen, TestTube, Play, ChartBar, Sparkle } from '@phosphor-icons/react'
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
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard 
        label={t('dashboard.projectsKpi')} 
        value={stats.totalProjects} 
        icon={FolderOpen} 
        accent="primary"
        href="/projects"
        subtext={t('dashboard.activeThisWeek')}
      />
      <KpiCard 
        label={t('dashboard.suitesKpi')} 
        value={stats.totalSuites} 
        icon={TestTube} 
        accent="running"
        href="/projects"
        trend={{ value: 5, label: t('dashboard.vsPrior7d'), isPercentage: false }}
      />
      <KpiCard
        label={t('dashboard.runsKpi')}
        value={stats.totalRuns}
        icon={Play}
        accent="fail"
        href="/projects"
        trend={{ value: 1, label: t('dashboard.vsPrior7d'), isPercentage: false }}
      />
      <KpiCard
        label={t('dashboard.passRateKpi')}
        value={`${stats.passRateLast7d}%`}
        icon={ChartBar}
        accent="pass"
        href="/projects"
        trend={{ 
          value: stats.passRateTrend || 8, 
          label: t('dashboard.vsPrior7d'), 
          isPercentage: true 
        }}
      />
      <KpiCard
        label={t('dashboard.pendingAiKpi')}
        value={stats.pendingAiCases}
        icon={Sparkle}
        accent="ai"
        href="/review-inbox"
        subtext={t('dashboard.readyForReview')}
      />
      </dl>
    </section>
  )
}
