'use client'

import { KpiRow } from './kpi-row'
import { ProjectStatusTable } from './project-status-table'
import { ProjectStatusDonut } from './project-status-donut'
import { PassRateTrend } from './pass-rate-trend'
import { PendingProposals } from './pending-ai-cases'
import { RecentActivity } from './recent-activity'
import { TraceabilitySection } from './traceability-section'

export function DashboardPage() {
  return (
    <section
      aria-label="Dashboard"
      className="@container w-full space-y-5 px-5 py-6 text-default @md:space-y-6 sm:px-7 lg:px-9 lg:py-6"
    >
      <KpiRow />

      <TraceabilitySection />

      <div className="grid grid-cols-1 gap-5 @md:gap-6 @3xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,1fr)]">
        <ProjectStatusTable />
        <div className="flex flex-col gap-5 @md:gap-6">
          <PassRateTrend />
          <ProjectStatusDonut />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 @md:gap-6 @3xl:grid-cols-[minmax(0,1.28fr)_minmax(21rem,0.72fr)]">
        <RecentActivity />
        <PendingProposals />
      </div>
    </section>
  )
}
