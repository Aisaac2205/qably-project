'use client'

import { useMemo, useState } from 'react'
import type { DashboardPeriod } from '@qably/types'
import {
  PieChart,
  PieSlice,
  PieCenter,
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  type PieData,
  type LegendItemData,
} from '@/components/charts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { useTranslation } from '@/lib/i18n'

export interface CasesGaugeCardProps {
  period: DashboardPeriod
  projectId?: string
}

export function CasesGaugeCard({ period, projectId }: CasesGaugeCardProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t } = useTranslation()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const title = t('dashboard.casesTitle')

  const totalDecided =
    overview === undefined
      ? 0
      : overview.casesPassing.pass +
        overview.casesPassing.fail +
        overview.casesPassing.blocked +
        overview.casesPassing.skip

  const pieData: PieData[] = useMemo(() => {
    if (!overview) return []
    const total = overview.casesPassing.total || totalDecided || 0
    const critical = overview.casePriorities?.critical ?? Math.round(total * 0.28)
    const high = overview.casePriorities?.high ?? Math.round(total * 0.48)
    const mediumLow = overview.casePriorities
      ? overview.casePriorities.medium + overview.casePriorities.low
      : Math.max(0, total - critical - high)

    return [
      {
        label: t('dashboard.priorityCritical'),
        value: critical,
        color: '#ef4444',
      },
      {
        label: t('dashboard.priorityHigh'),
        value: high,
        color: '#0ea5e9',
      },
      {
        label: t('dashboard.priorityMediumLow'),
        value: mediumLow,
        color: '#a855f7',
      },
    ]
  }, [overview, totalDecided, t])

  const totalValue = useMemo(() => pieData.reduce((acc, curr) => acc + curr.value, 0), [pieData])

  const legendItems: LegendItemData[] = useMemo(() => {
    return pieData.map((item) => ({
      label: item.label,
      value: item.value,
      maxValue: totalValue,
      color: item.color || '#0ea5e9',
    }))
  }, [pieData, totalValue])

  return (
    <Card as="section" aria-labelledby="cases-gauge-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" id="cases-gauge-heading">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-5 pt-0">
        {isError ? (
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : isLoading || overview === undefined ? (
          <Skeleton className="size-44 rounded-full" />
        ) : totalValue === 0 ? (
          <StateView kind="empty" title={t('dashboard.casesEmptyTitle')} />
        ) : (
          <>
            <div
              role="img"
              aria-label={t('dashboard.casesGaugeLabel')}
              className="relative flex items-center justify-center py-1"
            >
              <PieChart
                data={pieData}
                hoveredIndex={hoveredIndex}
                innerRadius={55}
                onHoverChange={setHoveredIndex}
                size={180}
              >
                {pieData.map((_, i) => (
                  <PieSlice index={i} key={i} />
                ))}
                <PieCenter defaultLabel={t('dashboard.casesTotalLabel')} />
              </PieChart>
            </div>

            <Legend
              hoveredIndex={hoveredIndex}
              items={legendItems}
              onHoverChange={setHoveredIndex}
            >
              <LegendItemComponent>
                <LegendMarker />
                <LegendLabel />
              </LegendItemComponent>
            </Legend>
          </>
        )}
      </CardContent>
    </Card>
  )
}
