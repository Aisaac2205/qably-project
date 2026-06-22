'use client'

import { FolderOpen, TestTube, Play, ChartBar, Sparkle } from '@phosphor-icons/react'
import { KpiCard } from './kpi-card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'

export function KpiRow() {
  const stats = useDashboardStats()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard 
        label="Projects" 
        value={stats.totalProjects} 
        icon={FolderOpen} 
        accent="primary"
        subtext="2 active this week"
      />
      <KpiCard 
        label="Test Suites" 
        value={stats.totalSuites} 
        icon={TestTube} 
        accent="running"
        trend={{ value: 5, label: 'vs last 7 days', isPercentage: false }}
      />
      <KpiCard
        label="Runs (7d)"
        value={stats.totalRuns}
        icon={Play}
        accent="fail"
        trend={{ value: 1, label: 'vs last 7 days', isPercentage: false }}
      />
      <KpiCard
        label="Pass Rate (7d)"
        value={`${stats.passRateLast7d}%`}
        icon={ChartBar}
        accent="pass"
        trend={{ 
          value: stats.passRateTrend || 8, 
          label: 'vs prior 7d', 
          isPercentage: true 
        }}
      />
      <KpiCard
        label="Pending AI"
        value={stats.pendingAiCases}
        icon={Sparkle}
        accent="ai"
        subtext="Ready for review"
      />
    </div>
  )
}
