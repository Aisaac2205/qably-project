'use client'

import { useCallback, useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { TrendDown, TrendUp } from '@phosphor-icons/react'
import {
  ChartContainer,
  ChartTooltip,
  useCoarsePointer,
  type ChartConfig,
} from '@qably/ui/chart'
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
import { useTranslation } from '@/lib/i18n'

export interface PassRateHeroProps {
  period: DashboardPeriod
  projectId?: string
}

const CURRENT_COLOR: `var(--qb-chart-${string})` = 'var(--qb-chart-line)'
const PREVIOUS_COLOR: `var(--qb-chart-${string})` = 'var(--qb-chart-compare)'

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-60 w-full rounded-lg" />
    </div>
  )
}

function resolveXTickIds(points: readonly ExecutedCasesPoint[]): string[] {
  const tickCount = Math.min(5, points.length)

  return Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, index) => {
        const pointIndex = Math.round((index * (points.length - 1)) / (tickCount - 1 || 1))
        return points[pointIndex]?.id
      }),
    ),
  ).filter((id): id is string => id !== undefined)
}

function metricRow(label: string, value: number) {
  return (
    <div key={label} className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-mono tabular-nums text-qb-fg">{value}</span>
    </div>
  )
}

function HeroTooltipContent({
  active,
  point,
  seriesLabels,
  metricLabels,
}: {
  active: boolean
  point: ExecutedCasesPoint | undefined
  seriesLabels: { current: string; previous: string }
  metricLabels: { passed: string; failed: string; blocked: string }
}) {
  if (!active || !point) return null

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-qb-border/50 bg-qb-surface px-2.5 py-1.5 text-xs shadow-qb-pop">
      <div className="font-medium text-qb-fg">{point.label}</div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: CURRENT_COLOR }}
          />
          <div className="flex flex-1 items-center justify-between gap-4">
            <span className="text-qb-muted">{seriesLabels.current}</span>
            <span className="font-mono font-medium tabular-nums text-qb-fg">{point.current}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0 w-2.5 shrink-0 border-t-2 border-dashed"
            style={{ borderColor: PREVIOUS_COLOR }}
          />
          <div className="flex flex-1 items-center justify-between gap-4">
            <span className="text-qb-muted">{seriesLabels.previous}</span>
            <span className="font-mono font-medium tabular-nums text-qb-fg">{point.previous}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-1 border-t border-qb-border/40 pt-1.5 text-qb-muted">
        {metricRow(metricLabels.passed, point.passed)}
        {metricRow(metricLabels.failed, point.failed)}
        {metricRow(metricLabels.blocked, point.blocked)}
      </div>
    </div>
  )
}

export function PassRateHero({ period, projectId }: PassRateHeroProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t, locale } = useTranslation()
  const isCoarsePointer = useCoarsePointer()
  const trigger = isCoarsePointer ? 'click' : 'hover'

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }),
    [locale],
  )
  const formatLabel = useCallback((date: string) => dateFormatter.format(new Date(date)), [dateFormatter])

  const points =
    overview === undefined
      ? []
      : buildExecutedCasesPoints(overview.passRateSeries.current, overview.passRateSeries.previous, formatLabel)

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

  const config: ChartConfig = {
    current: { label: seriesLabels.current, color: CURRENT_COLOR },
    previous: { label: seriesLabels.previous, color: PREVIOUS_COLOR },
  }

  const footerTrendText =
    trend.direction === 'equal'
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

  const TrendIcon = trend.direction === 'up' ? TrendUp : trend.direction === 'down' ? TrendDown : null
  const xTickIds = resolveXTickIds(points)
  const idToLabel = new Map(points.map((point) => [point.id, point.label]))

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
            <p className="py-12 text-center text-xs text-muted">{t('dashboard.heroEmptyLabel')}</p>
          ) : (
            <div className="h-60 min-w-0">
              <ChartContainer config={config} initialDimension={{ width: 640, height: 224 }} className="aspect-auto h-full w-full">
                <LineChart
                  data={points as ExecutedCasesPoint[]}
                  accessibilityLayer
                  tabIndex={0}
                  aria-label={t('dashboard.heroLabel')}
                  className="touch-pan-y"
                  margin={{ top: 16, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--qb-chart-grid)" />
                  <XAxis
                    dataKey="id"
                    ticks={xTickIds}
                    tickFormatter={(id: string) => idToLabel.get(id) ?? ''}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ className: 'fill-qb-muted font-mono', fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(value: number) => formatCompactNumber(value, locale)}
                    tick={{ className: 'fill-qb-muted font-mono tabular-nums', fontSize: 11 }}
                  />
                  <ChartTooltip
                    cursor={{ stroke: 'var(--qb-chart-line)', strokeOpacity: 0.18, strokeWidth: 1 }}
                    trigger={trigger}
                    allowEscapeViewBox={{ x: false, y: true }}
                    content={(tooltipProps) => (
                      <HeroTooltipContent
                        active={Boolean(tooltipProps.active)}
                        point={
                          tooltipProps.active
                            ? (tooltipProps.payload?.[0]?.payload as ExecutedCasesPoint | undefined)
                            : undefined
                        }
                        seriesLabels={seriesLabels}
                        metricLabels={metricLabels}
                      />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke={CURRENT_COLOR}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: CURRENT_COLOR, strokeWidth: 2, className: 'fill-qb-surface' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke={PREVIOUS_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 3, fill: PREVIOUS_COLOR, className: 'stroke-qb-surface' }}
                  />
                </LineChart>
              </ChartContainer>

              <ChartDataTable
                caption={t('dashboard.heroLabel')}
                rows={points}
                rowKey={(point) => point.id}
                columns={[
                  { key: 'day', header: t('dashboard.heroDayLabel'), render: (point) => point.label },
                  { key: 'current', header: seriesLabels.current, render: (point) => point.current },
                  { key: 'previous', header: seriesLabels.previous, render: (point) => point.previous },
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
