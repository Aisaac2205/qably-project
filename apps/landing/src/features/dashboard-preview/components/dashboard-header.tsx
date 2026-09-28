import React from 'react'
import type { DashboardPeriod } from '@qably/types'

const DASHBOARD_PERIODS: readonly DashboardPeriod[] = [7, 30, 90] as const
import AnimatedDropdown from '@/components/ui/animated-dropdown'
import { useTranslation } from '@/lib/i18n'

export interface DashboardHeaderProps {
  period: DashboardPeriod
  onPeriodChange: (period: DashboardPeriod) => void
}

export function DashboardHeader({ period, onPeriodChange }: DashboardHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-dashboard flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <p className="max-w-3xl text-sm text-muted text-wrap-pretty">{t('dashboard.headerSubtitle')}</p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <AnimatedDropdown
          align="right"
          aria-label={t('dashboard.periodLabel')}
          text={t(`dashboard.period${period}d`)}
          items={DASHBOARD_PERIODS.map((value) => ({
            name: t(`dashboard.period${value}d`),
            value,
            active: period === value,
            onClick: () => onPeriodChange(value),
          }))}
        />
      </div>
    </div>
  )
}
