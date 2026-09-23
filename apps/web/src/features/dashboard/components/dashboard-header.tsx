'use client'

import type { DashboardPeriod } from '@qably/types'
import { DASHBOARD_PERIODS } from '@qably/types'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTranslation } from '@/lib/i18n'

type PeriodValue = `${DashboardPeriod}`

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
        <SegmentedControl<PeriodValue>
          label={t('dashboard.periodLabel')}
          semantics="toggle"
          size="sm"
          value={String(period) as PeriodValue}
          onChange={(value) => onPeriodChange(Number(value) as DashboardPeriod)}
          options={DASHBOARD_PERIODS.map((value) => ({
            value: String(value) as PeriodValue,
            label: t(`dashboard.period${value}d`),
          }))}
        />
      </div>
    </div>
  )
}
