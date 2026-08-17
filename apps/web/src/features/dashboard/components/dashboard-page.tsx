'use client'

import { KpiRow } from './kpi-row'
import { ProjectHealthTable } from './project-health-table'
import { PassRateTrend } from './pass-rate-trend'
import { PendingAiCases } from './pending-ai-cases'
import { RecentActivity } from './recent-activity'
import { GovernancePipeline } from './governance-pipeline'
import { QualityRiskPanel } from './quality-risk-panel'

export function DashboardPage() {
  return (
    <section aria-label="Dashboard" className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6">
      <KpiRow />

      <GovernancePipeline />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,1fr)]">
        <ProjectHealthTable />
        <PassRateTrend />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(21rem,0.72fr)]">
        <RecentActivity />
        <PendingAiCases />
      </div>

      <QualityRiskPanel />
    </section>
  )
}
