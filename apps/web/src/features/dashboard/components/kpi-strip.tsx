'use client'

import type { DailyPoint, DashboardPeriod } from '@qably/types'
import { Card } from '@/components/ui/card'
import { KpiStatCard, type KpiStatPoint, type KpiStatTone } from '@/components/ui/kpi-stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { formatSeriesDayLabel, formatSeriesRange, parseSeriesDate } from '@/features/dashboard/lib/series-date'
import { resolveNumberLocale, useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const SKELETON_COUNT = 4

type DailyMetric = 'executed' | 'runs' | 'failed' | 'failedRuns'

export interface KpiStripProps {
  period: DashboardPeriod
  projectId?: string
}

function toSeries(points: readonly DailyPoint[], metric: DailyMetric): KpiStatPoint[] {
  return points.map((point) => ({ date: parseSeriesDate(point.date), value: point[metric] }))
}

function total(points: readonly DailyPoint[], metric: DailyMetric): number {
  return points.reduce((sum, point) => sum + point[metric], 0)
}

function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function buildKpiFormatLabel(
  points: readonly DailyPoint[],
  granularity: 'day' | 'week',
  locale: 'es' | 'en',
): (date: Date) => string {
  return (date: Date) => {
    const point = points.find((p) => parseSeriesDate(p.date).getTime() === date.getTime())
    return point ? formatSeriesRange(point, granularity, locale) : formatSeriesDayLabel(date, locale)
  }
}

function StripShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="mx-auto min-w-0 w-full max-w-dashboard @container">
      {children}
    </section>
  )
}

export function KpiStrip({ period, projectId }: KpiStripProps) {
  const { overview, isLoading, isRefreshing, isError, retry } = useDashboardOverview(period, projectId)
  const { t, locale } = useTranslation()
  const stripLabel = t('dashboard.kpiStripLabel')

  if (isLoading) {
    return (
      <StripShell label={stripLabel}>
        <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2 @2xl:grid-cols-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-[168px] rounded-xl" />
          ))}
        </div>
      </StripShell>
    )
  }

  if (isError || overview === undefined) {
    return (
      <StripShell label={stripLabel}>
        <Card>
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
        </Card>
      </StripShell>
    )
  }

  const current = overview.passRateSeries.current
  const previous = overview.passRateSeries.previous

  if (total(current, 'runs') === 0) {
    return (
      <StripShell label={stripLabel}>
        <Card>
          <StateView kind="empty" title={t('dashboard.kpiEmptyTitle')} />
        </Card>
      </StripShell>
    )
  }

  const cards: { metric: DailyMetric; label: string; tone: KpiStatTone }[] = [
    { metric: 'executed', label: t('dashboard.kpiExecutedCasesLabel'), tone: 'primary' },
    { metric: 'runs', label: t('dashboard.kpiRunsLabel'), tone: 'muted' },
    { metric: 'failed', label: t('dashboard.kpiFailedCasesLabel'), tone: 'fail' },
    { metric: 'failedRuns', label: t('dashboard.kpiFailedRunsLabel'), tone: 'warn' },
  ]

  const granularity = overview.passRateSeries.granularity
  const formatLabel = buildKpiFormatLabel(current, granularity, locale)

  return (
    <StripShell label={stripLabel}>
      <div
        className={cn(
          'grid grid-cols-1 gap-3 transition-opacity duration-200 @xs:grid-cols-2 @2xl:grid-cols-4',
          isRefreshing && 'opacity-60',
        )}
      >
        {cards.map((card) => (
          <KpiStatCard
            key={card.metric}
            label={card.label}
            value={total(current, card.metric)}
            series={toSeries(current, card.metric)}
            tone={card.tone}
            trend={trendPercent(total(current, card.metric), total(previous, card.metric))}
            format={{ notation: 'compact', maximumFractionDigits: 1 }}
            locale={resolveNumberLocale(locale)}
            formatLabel={formatLabel}
            chartLabel={t('dashboard.kpiSparklineLabel', { label: card.label })}
          />
        ))}
      </div>
    </StripShell>
  )
}
