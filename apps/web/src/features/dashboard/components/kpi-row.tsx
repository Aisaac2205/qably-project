'use client'

import { FolderOpen, TestTube, Play, ChartBar, Sparkle } from '@phosphor-icons/react'
import { KpiCard } from './kpi-card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatPassRate } from '@/features/dashboard/lib/format'

export function KpiRow() {
  const stats = useDashboardStats()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard label="Projects" value={stats.totalProjects} icon={FolderOpen} />
      <KpiCard label="Test Suites" value={stats.totalSuites} icon={TestTube} />
      <KpiCard
        label="Runs (7d)"
        value={stats.totalRuns}
        icon={Play}
        accent="default"
      />
      <KpiCard
        label="Pass Rate (7d)"
        value={formatPassRate(stats.passRateLast7d)}
        icon={ChartBar}
        accent={stats.passRateTrend > 0 ? 'pass' : stats.passRateTrend < 0 ? 'fail' : 'default'}
        trend={
          stats.passRateTrend !== 0
            ? { value: stats.passRateTrend, label: 'vs prior 7d' }
            : undefined
        }
      />
      <KpiCard
        label="Pending AI"
        value={stats.pendingAiCases}
        icon={Sparkle}
        accent="ai"
      />
    </div>
  )
}
