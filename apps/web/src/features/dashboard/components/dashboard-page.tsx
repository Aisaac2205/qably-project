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
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 bg-canvas min-h-screen text-default">
      <h1 className="sr-only text-2xl font-semibold tracking-tight">{t('sidebar.dashboard')}</h1>
      <span className="sr-only">Welcome back, {org.name}</span>

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-default">
          {t('dashboard.greeting')}, Isaac 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <KpiRow />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectHealthTable />
        <PassRateTrend />
        <AiCasesOverview />
        <RecentActivity />
      </div>

      <footer className="flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground pb-8">
        <div>
          © 2026 Qably · {t('dashboard.allOperational')}
          <span className="inline-block w-2 h-2 rounded-full bg-pass animate-pulse ml-2" />
        </div>
      </footer>
    </div>
  )
}
