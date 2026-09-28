import React, { useCallback, useMemo } from 'react'
import { TrendDown, TrendUp } from '@phosphor-icons/react'
import { Area, AreaChart } from '@/components/charts'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import type { DashboardOverviewRecord, DashboardPeriod } from '@qably/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import {
  buildExecutedCasesPoints,
  resolveExecutedCasesTrend,
  resolvePeriodRangeLabel,
  type ExecutedCasesPoint,
} from '../lib/executed-cases-domain'
import { formatCompactNumber } from '../lib/format'
import { parseSeriesDate } from '../lib/series-date'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChartDataTable } from './chart-data-table'

export interface PassRateHeroProps {
  overview: DashboardOverviewRecord
  period: DashboardPeriod
}

const CURRENT_COLOR = 'var(--qb-chart-line)'
const PREVIOUS_COLOR = 'var(--qb-chart-compare)'

export function PassRateHero({ overview, period }: PassRateHeroProps) {
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

  const points = buildExecutedCasesPoints(
    overview.passRateSeries.current,
    overview.passRateSeries.previous,
    formatLabel,
  )

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

  const tableRows: readonly [string, number][] = points.map((p) => [p.label, p.current])

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
          <div className="h-60 min-w-0">
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
              <YAxis formatValue={(value) => formatCompactNumber(value, locale as 'es' | 'en')} />
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
              headers={[t('dashboard.heroDayLabel'), seriesLabels.current]}
              rows={tableRows}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-default">
            {TrendIcon !== null ? <TrendIcon size={16} weight="bold" aria-hidden="true" className={trend.direction === 'up' ? 'text-pass' : 'text-fail'} /> : null}
            {footerTrendText}
          </span>
          <span className="text-xs text-muted">{t('dashboard.heroFooterSubtitle', { count: period })}</span>
        </CardFooter>
      </Card>
    </div>
  )
}
