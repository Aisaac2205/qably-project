'use client'

import { KpiRow } from './kpi-row'
import { ProjectHealthTable } from './project-health-table'
import { PassRateTrend } from './pass-rate-trend'
import { AiCasesOverview } from './ai-cases-overview'
import { RecentActivity } from './recent-activity'
import { useOrg } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'

export function DashboardPage() {
  const org = useOrg()
  const { t } = useTranslation()

  return (
    <div className="mx-auto min-h-full max-w-[1440px] px-5 py-7 text-default sm:px-7 lg:px-9 lg:py-9">
      <header className="mb-7 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-muted">{org.name}</p>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-default">
          {t('sidebar.dashboard')}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">{t('dashboard.subtitle')}</p>
      </header>

      <KpiRow />

      <div className="mt-7 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,1fr)]">
        <ProjectHealthTable />
        <PassRateTrend />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)]">
        <AiCasesOverview />
        <RecentActivity />
      </div>

      <footer className="mt-8 border-t border-border pt-5 text-xs text-muted">
        {t('dashboard.allOperational')}
      </footer>
    </div>
  )
}