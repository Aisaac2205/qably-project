'use client'

import { useMemo } from 'react'
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { TrendChart } from '@qably/ui/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

function trendTone(value: number): string {
  if (value > 0) return 'text-pass'
  if (value < 0) return 'text-fail'
  return 'text-muted'
}

function PassRateTrendSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-between">
      <div className="mb-4 flex items-baseline gap-2">
        <Skeleton className="h-9 w-16 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
}

export function PassRateTrend() {
  const stats = useDashboardStats()
  const { t, locale } = useTranslation()

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }),
    [locale],
  )

  const points = useMemo(
    () =>
      [...stats.recentRuns]
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
        .map((run) => ({
          id: run.id,
          label: dateFormatter.format(new Date(run.startedAt)),
          value: Math.round(run.passRate * 100),
        })),
    [stats.recentRuns, dateFormatter],
  )

  const trend = stats.passRateTrend

  return (
    <Card className="col-span-1 flex flex-col justify-between border border-border/80">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
        <CardTitle>{t('dashboard.passRateTrend')}</CardTitle>
        <span className="rounded-lg border border-border bg-canvas px-2 py-1 text-xs font-semibold text-muted">
          {t('dashboard.windowDays', { count: stats.windowDays })}
        </span>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-5 pt-0">
        {stats.summaryState.isError ? (
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={stats.summaryState.retry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : stats.summaryState.isLoading ? (
          <PassRateTrendSkeleton />
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-[-0.025em] text-default">
                {stats.passRateLast7d}%
              </span>
              <div className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${trendTone(trend)}`}>
                {trend > 0 ? <ArrowUp size={12} weight="bold" aria-hidden="true" /> : null}
                {trend < 0 ? <ArrowDown size={12} weight="bold" aria-hidden="true" /> : null}
                <span>
                  {trend > 0 ? '+' : ''}
                  {trend}%
                </span>
                <span className="ml-1 text-xs font-normal text-muted">{t('dashboard.vsPrior7d')}</span>
              </div>
            </div>

            <TrendChart
              points={points}
              label={t('dashboard.passRateTrendChart', { count: points.length })}
              emptyLabel={t('dashboard.noRuns')}
              valueFormatter={(value) => `${value}%`}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
