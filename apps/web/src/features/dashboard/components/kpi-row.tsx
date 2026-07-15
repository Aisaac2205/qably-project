'use client'

import { FolderOpen, TestTube, Play, ChartBar, Sparkle } from '@phosphor-icons/react'
import { KpiCard } from './kpi-card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

export function KpiRow() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard 
        label={t('dashboard.projectsKpi')} 
        value={stats.totalProjects} 
        icon={FolderOpen} 
        accent="primary"
        subtext={t('dashboard.activeThisWeek')}
      />
      <KpiCard 
        label={t('dashboard.suitesKpi')} 
        value={stats.totalSuites} 
        icon={TestTube} 
        accent="running"
        trend={{ value: 5, label: t('dashboard.vsPrior7d'), isPercentage: false }}
      />
      <KpiCard
        label={t('dashboard.runsKpi')}
        value={stats.totalRuns}
        icon={Play}
        accent="fail"
        trend={{ value: 1, label: t('dashboard.vsPrior7d'), isPercentage: false }}
      />
      <KpiCard
        label={t('dashboard.passRateKpi')}
        value={`${stats.passRateLast7d}%`}
        icon={ChartBar}
        accent="pass"
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
        subtext={t('dashboard.readyForReview')}
      />
    </div>
  )
}
