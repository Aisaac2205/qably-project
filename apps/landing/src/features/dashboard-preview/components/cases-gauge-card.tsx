import React, { useMemo, useState } from 'react'
import type { DashboardOverviewRecord } from '@qably/types'
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
import { useTranslation } from '@/lib/i18n'

export interface CasesGaugeCardProps {
  overview: DashboardOverviewRecord
}

export function CasesGaugeCard({ overview }: CasesGaugeCardProps) {
  const { t } = useTranslation()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const title = t('dashboard.casesTitle')

  const pieData: PieData[] = useMemo(() => {
    const priorities = overview.casePriorities
    if (!priorities) return []

    return [
      {
        label: t('dashboard.priorityCritical'),
        value: priorities.critical,
        color: 'var(--qb-chart-fail)',
      },
      {
        label: t('dashboard.priorityHigh'),
        value: priorities.high,
        color: 'var(--qb-chart-warn)',
      },
      {
        label: t('dashboard.priorityMedium'),
        value: priorities.medium,
        color: 'var(--qb-chart-accent)',
      },
      {
        label: t('dashboard.priorityLow'),
        value: priorities.low,
        color: 'var(--qb-chart-line)',
      },
    ]
  }, [overview, t])

  const totalValue = useMemo(() => pieData.reduce((acc, curr) => acc + curr.value, 0), [pieData])

  const legendItems: LegendItemData[] = useMemo(() => {
    return pieData.map((item) => ({
      label: item.label,
      value: item.value,
      maxValue: totalValue,
      color: item.color || 'var(--qb-chart-warn)',
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
      </CardContent>
    </Card>
  )
}
