'use client'

import { useCallback, useMemo } from 'react'
import { TrendDown, TrendUp } from '@phosphor-icons/react'
import { Area, AreaChart } from '@/components/charts'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import { ChartDataTable } from '@qably/ui/dashboard'
import type { DashboardPeriod } from '@qably/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import {
  buildExecutedCasesPoints,
  resolveExecutedCasesTrend,
  resolvePeriodRangeLabel,
  type ExecutedCasesPoint,
} from '@/features/dashboard/lib/executed-cases-domain'
import { formatCompactNumber } from '@/features/dashboard/lib/format'
import { parseSeriesDate } from '@/features/dashboard/lib/series-date'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface PassRateHeroProps {
  period: DashboardPeriod
  projectId?: string
}

const CURRENT_COLOR = 'var(--qb-chart-line)'
const PREVIOUS_COLOR = 'var(--qb-chart-compare)'

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-60 w-full rounded-lg" />
    </div>
  )
}

export function PassRateHero({ period, projectId }: PassRateHeroProps) {
  const { overview, isLoading, isRefreshing, isError, retry } = useDashboardOverview(period, projectId)
  const { t, locale } = useTranslation()

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }),
    [locale],
  )
  const formatLabel = useCallback((date: string) => dateFormatter.format(parseSeriesDate(date)), [dateFormatter])

  const longDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long' }),
    [locale],
  )

  const points =
    overview === undefined
      ? []
      : buildExecutedCasesPoints(overview.passRateSeries.current, overview.passRateSeries.previous, formatLabel)

  const chartData = useMemo(
    () => points.map((point) => ({ ...point, date: parseSeriesDate(point.id) })),
    [points],
  )

  const trend = resolveExecutedCasesTrend(points)
  const periodRangeLabel = resolvePeriodRangeLabel(points, formatLabel)

  const seriesLabels = {
    current: t('dashboard.heroSeriesCurrent'),
    previous: t('dashboard.heroSeriesPrevious'),
  }
  const metricLabels = {
    passed: t('dashboard.heroMetricPassed'),
    failed: t('dashboard.heroMetricFailed'),
    blocked: t('dashboard.heroMetricBlocked'),
  }

  const hasBaseline = points.some((point) => point.previous > 0)
  const firstDataPoint = points.find((point) => point.current > 0)
  const firstDataLabel = firstDataPoint ? longDateFormatter.format(parseSeriesDate(firstDataPoint.id)) : ''

  const footerTrendText = !hasBaseline
    ? t('dashboard.heroFooterNoBaseline', { date: firstDataLabel })
    : trend.direction === 'equal'
      ? t('dashboard.heroFooterNoChange')
      : trend.percent === null
        ? t(
            trend.direction === 'up'
              ? 'dashboard.heroFooterTrendUpNoPercent'
              : 'dashboard.heroFooterTrendDownNoPercent',
          )
        : t(trend.direction === 'up' ? 'dashboard.heroFooterTrendUp' : 'dashboard.heroFooterTrendDown', {
            percent: trend.percent,
          })

  const TrendIcon = !hasBaseline
    ? null
    : trend.direction === 'up'
      ? TrendUp
      : trend.direction === 'down'
        ? TrendDown
        : null

  return (
    <div className="mx-auto w-full max-w-dashboard">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-0.5">
            <CardTitle as="h2">{t('dashboard.heroTitle')}</CardTitle>
            {periodRangeLabel !== null ? <CardDescription>{periodRangeLabel}</CardDescription> : null}
          </div>
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
          ) : points.length === 0 ? (
            <StateView kind="empty" title={t('dashboard.heroEmptyLabel')} className="min-h-60" />
          ) : (
            <div
              className={cn(
                'h-60 min-w-0 transition-opacity duration-200',
                isRefreshing && 'opacity-60',
              )}
            >
              <AreaChart
                aspectRatio="auto"
                className="h-full w-full touch-none"
                data={chartData as unknown as Record<string, unknown>[]}
                margin={{ top: 16, right: 16, bottom: 44, left: 48 }}
              >
                <Grid horizontal />
                <Area
                  dataKey="current"
                  fill={CURRENT_COLOR}
                  fillOpacity={0.2}
                  showHighlight
                  stroke={CURRENT_COLOR}
                  strokeWidth={2}
                />
                {hasBaseline ? (
                  <Area
                    dataKey="previous"
                    dashArray="5 5"
                    dashFromIndex={0}
                    fill={PREVIOUS_COLOR}
                    fillOpacity={0}
                    showHighlight={false}
                    stroke={PREVIOUS_COLOR}
                    strokeWidth={1.5}
                  />
                ) : null}
                <XAxis />
                <YAxis formatValue={(value) => formatCompactNumber(value, locale)} />
                <ChartTooltip
                  rows={(point) => [
                    {
                      color: CURRENT_COLOR,
                      label: seriesLabels.current,
                      value: Number(point.current ?? 0),
                    },
                    ...(hasBaseline
                      ? [
                          {
                            color: PREVIOUS_COLOR,
                            label: seriesLabels.previous,
                            value: Number(point.previous ?? 0),
                          },
                        ]
                      : []),
                    {
                      color: 'var(--qb-chart-pass)',
                      label: metricLabels.passed,
                      value: Number(point.passed ?? 0),
                    },
                    {
                      color: 'var(--qb-chart-fail)',
                      label: metricLabels.failed,
                      value: Number(point.failed ?? 0),
                    },
                    {
                      color: 'var(--qb-chart-warn)',
                      label: metricLabels.blocked,
                      value: Number(point.blocked ?? 0),
                    },
                  ]}
                  showCrosshair
                  showDots
                />
              </AreaChart>

              <ChartDataTable
                caption={t('dashboard.heroLabel')}
                rows={points}
                rowKey={(point: ExecutedCasesPoint) => point.id}
                columns={[
                  { key: 'day', header: t('dashboard.heroDayLabel'), render: (point) => point.label },
                  { key: 'current', header: seriesLabels.current, render: (point) => point.current },
                  ...(hasBaseline
                    ? [
                        {
                          key: 'previous',
                          header: seriesLabels.previous,
                          render: (point: ExecutedCasesPoint) => point.previous,
                        },
                      ]
                    : []),
                  { key: 'passed', header: metricLabels.passed, render: (point) => point.passed },
                  { key: 'failed', header: metricLabels.failed, render: (point) => point.failed },
                  { key: 'blocked', header: metricLabels.blocked, render: (point) => point.blocked },
                ]}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-default">
            {TrendIcon !== null ? <TrendIcon size={16} weight="bold" aria-hidden="true" /> : null}
            {footerTrendText}
          </span>
          <span className="text-xs text-muted">{t('dashboard.heroFooterSubtitle', { count: period })}</span>
        </CardFooter>
      </Card>
    </div>
  )
}
