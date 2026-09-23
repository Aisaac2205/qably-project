'use client'

import { useMemo } from 'react'
import { ComparisonAreaChart } from '@qably/ui/dashboard'
import type { DashboardPeriod } from '@qably/types'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { HERO_PASS_RATE_DOMAIN, HERO_PASS_RATE_TICKS, buildHeroPoints } from '@/features/dashboard/lib/hero-domain'
import { DASHBOARD_KPI_POLARITY, resolveKpiDeltaTone } from '@/features/dashboard/lib/kpi-delta'
import { formatKpiDelta, formatKpiValue } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

export interface PassRateHeroProps {
  period: DashboardPeriod
  projectId?: string
}

const DELTA_TONE_CLASSES = {
  better: 'text-pass',
  worse: 'text-fail',
  neutral: 'text-muted',
} as const

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-60 w-full rounded-lg" />
    </div>
  )
}

function HeroLegend({ currentLabel, previousLabel }: { currentLabel: string; previousLabel: string }) {
  return (
    <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: 'var(--qb-chart-line)' }} />
        {currentLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-0 w-3.5 border-t-2 border-dashed"
          style={{ borderColor: 'var(--qb-chart-compare)' }}
        />
        {previousLabel}
      </span>
    </div>
  )
}

export function PassRateHero({ period, projectId }: PassRateHeroProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t, locale } = useTranslation()

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }),
    [locale],
  )

  const points =
    overview === undefined
      ? []
      : buildHeroPoints(overview.passRateSeries.current, overview.passRateSeries.previous, (date) =>
          dateFormatter.format(new Date(date)),
        )

  const heroDeltaText =
    overview === undefined ? null : formatKpiDelta('passRate', overview.kpis.passRate.value, overview.kpis.passRate.previous)
  const heroDeltaTone =
    overview === undefined
      ? 'neutral'
      : resolveKpiDeltaTone(overview.kpis.passRate.value, overview.kpis.passRate.previous, DASHBOARD_KPI_POLARITY.passRate)

  return (
    <div className="mx-auto w-full max-w-dashboard">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-3 p-5">
          <div className="flex items-baseline gap-2">
            <CardTitle as="h2">{t('dashboard.heroTitle')}</CardTitle>
            {overview !== undefined ? (
              <>
                <span className="text-xl font-medium tracking-tight tabular-nums text-default">
                  {formatKpiValue('passRate', overview.kpis.passRate.value)}
                </span>
                {heroDeltaText !== null ? (
                  <span className={cn('text-xs font-medium tabular-nums', DELTA_TONE_CLASSES[heroDeltaTone])}>
                    {heroDeltaText}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <HeroLegend
            currentLabel={t('dashboard.heroSeriesCurrent')}
            previousLabel={t('dashboard.heroSeriesPrevious')}
          />
        </div>
        <CardContent>
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
            <HeroSkeleton />
          ) : (
            <div className="h-60 min-w-0">
              <ComparisonAreaChart
                points={points}
                label={t('dashboard.heroLabel')}
                emptyLabel={t('dashboard.heroEmptyLabel')}
                domain={HERO_PASS_RATE_DOMAIN}
                ticks={HERO_PASS_RATE_TICKS}
                valueFormatter={(value) => `${Math.round(value)}%`}
                seriesLabels={{
                  current: t('dashboard.heroSeriesCurrent'),
                  previous: t('dashboard.heroSeriesPrevious'),
                }}
                metricLabels={{
                  runs: t('dashboard.heroMetricRuns'),
                  failedRuns: t('dashboard.heroMetricFailedRuns'),
                }}
                dayLabel={t('dashboard.heroDayLabel')}
                className="h-full"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
