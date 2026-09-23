'use client'

import { useState } from 'react'
import type { DashboardPeriod } from '@qably/types'
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header'
import { KpiStrip } from '@/features/dashboard/components/kpi-strip'
import { PassRateHero } from '@/features/dashboard/components/pass-rate-hero'
import { ProjectsTable } from '@/features/dashboard/components/projects-table'
import { CasesGaugeCard } from '@/features/dashboard/components/cases-gauge-card'
import { ChannelsCard } from '@/features/dashboard/components/channels-card'
import { ActivityCard } from '@/features/dashboard/components/activity-card'

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>(30)

  return (
    <section
      aria-label="Dashboard"
      className="@container w-full space-y-5 px-5 py-6 text-default @md:space-y-6 sm:px-7 lg:px-9 lg:py-6"
    >
      <DashboardHeader period={period} onPeriodChange={setPeriod} />
      <KpiStrip period={period} />
      <PassRateHero period={period} />

      <div className="mx-auto w-full max-w-dashboard @container">
        <div data-testid="dashboard-row-grid" className="grid grid-cols-1 gap-5 @3xl:grid-cols-3 @md:gap-6">
          <div className="min-w-0 @3xl:col-span-2">
            <ProjectsTable period={period} />
          </div>
          <div className="min-w-0">
            <CasesGaugeCard period={period} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-dashboard @container">
        <div data-testid="dashboard-row-grid" className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @md:gap-6">
          <div className="min-w-0">
            <ChannelsCard />
          </div>
          <div className="min-w-0">
            <ActivityCard period={period} />
          </div>
        </div>
      </div>
    </section>
  )
}
