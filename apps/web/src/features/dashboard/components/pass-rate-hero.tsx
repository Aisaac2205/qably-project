'use client'

import { useMemo } from 'react'
import { ComparisonAreaChart } from '@qably/ui/dashboard'
import type { DashboardPeriod } from '@qably/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { HERO_PASS_RATE_DOMAIN, HERO_PASS_RATE_TICKS, buildHeroPoints } from '@/features/dashboard/lib/hero-domain'
import { useTranslation } from '@/lib/i18n'

export interface PassRateHeroProps {
  period: DashboardPeriod
  projectId?: string
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-48 w-full rounded-lg @xl:h-56" />
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

  return (
    <div className="mx-auto w-full max-w-dashboard">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('dashboard.heroTitle')}</CardTitle>
        </CardHeader>
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
            <div className="h-48 min-w-0 @xl:h-56">
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
