'use client'

import type { DashboardPeriod } from '@qably/types'
import { DASHBOARD_PERIODS } from '@qably/types'
import { PageHeader } from '@/components/ui/page-header'
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
    <div className="mx-auto w-full max-w-dashboard">
      <PageHeader
        title={t('dashboard.headerTitle')}
        description={t('dashboard.headerSubtitle')}
        actions={
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
        }
      />
    </div>
  )
}
