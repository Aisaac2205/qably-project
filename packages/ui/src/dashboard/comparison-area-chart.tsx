'use client'

import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  useActiveTooltipDataPoints,
  useActiveTooltipLabel,
  useIsTooltipActive,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../utils'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../chart/chart'
import { useCoarsePointer } from '../chart/use-coarse-pointer'
import { useDebouncedValue } from '../chart/use-debounced-value'
import { ChartDataTable } from './chart-data-table'

const ANNOUNCE_DEBOUNCE_MS = 300

export interface ComparisonAreaPoint {
  id: string
  label: string
  current: number | null
  previous: number | null
  runs?: number | null
  failedRuns?: number | null
}

export interface ComparisonAreaChartProps {
  points: readonly ComparisonAreaPoint[]
  label: string
  emptyLabel: string
  domain: readonly [number, number]
  ticks: readonly number[]
  valueFormatter: (value: number) => string
  seriesLabels: { current: string; previous: string }
  metricLabels?: { runs: string; failedRuns: string }
  dayLabel?: string
  yAxisWidth?: number
  className?: string
}

const CURRENT_COLOR: `var(--qb-chart-${string})` = 'var(--qb-chart-line)'
const PREVIOUS_COLOR: `var(--qb-chart-${string})` = 'var(--qb-chart-compare)'

function seriesRow(
  point: ComparisonAreaPoint,
  key: 'current' | 'previous',
  seriesLabel: string,
  color: string,
  valueFormatter: (value: number) => string,
) {
  const value = point[key]
  return (
    <div key={key} className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <div className="flex flex-1 items-center justify-between gap-4">
        <span className="text-qb-muted">{seriesLabel}</span>
        <span className="font-mono font-medium tabular-nums text-qb-fg">
          {value === null ? '—' : valueFormatter(value)}
        </span>
      </div>
    </div>
  )
}

function HeroTooltipContent({
  active,
  point,
  seriesLabels,
  metricLabels,
  valueFormatter,
}: {
  active: boolean
  point: ComparisonAreaPoint | undefined
  seriesLabels: { current: string; previous: string }
  metricLabels: { runs: string; failedRuns: string } | undefined
  valueFormatter: (value: number) => string
}) {
  if (!active || !point) return null

  const hasMetrics = metricLabels && (point.runs != null || point.failedRuns != null)

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-qb-border/50 bg-qb-surface px-2.5 py-1.5 text-xs shadow-qb-pop">
      <div className="font-medium text-qb-fg">{point.label}</div>
      <div className="grid gap-1.5">
        {seriesRow(point, 'current', seriesLabels.current, CURRENT_COLOR, valueFormatter)}
        {seriesRow(point, 'previous', seriesLabels.previous, PREVIOUS_COLOR, valueFormatter)}
      </div>
      {hasMetrics ? (
        <div className="grid gap-1 border-t border-qb-border/40 pt-1.5 text-qb-muted">
          {point.runs != null ? (
            <div className="flex items-center justify-between gap-4">
              <span>{metricLabels.runs}</span>
              <span className="font-mono tabular-nums text-qb-fg">{point.runs}</span>
            </div>
          ) : null}
          {point.failedRuns != null ? (
            <div className="flex items-center justify-between gap-4">
              <span>{metricLabels.failedRuns}</span>
              <span className="font-mono tabular-nums text-qb-fg">{point.failedRuns}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ActivePointAnnouncer({
  points,
  seriesLabels,
  valueFormatter,
}: {
  points: readonly ComparisonAreaPoint[]
  seriesLabels: { current: string; previous: string }
  valueFormatter: (value: number) => string
}) {
  const isActive = useIsTooltipActive()
  const activeLabel = useActiveTooltipLabel()
  useActiveTooltipDataPoints()

  const point = useMemo(
    () => points.find((candidate) => candidate.id === activeLabel),
    [points, activeLabel],
  )

  const text =
    isActive && point
      ? [
          point.label,
          point.current === null ? null : `${seriesLabels.current} ${valueFormatter(point.current)}`,
          point.previous === null ? null : `${seriesLabels.previous} ${valueFormatter(point.previous)}`,
        ]
          .filter(Boolean)
          .join(', ')
      : ''

  const announcedText = useDebouncedValue(text, ANNOUNCE_DEBOUNCE_MS)

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcedText}
    </div>
  )
}

export function ComparisonAreaChart({
  points,
  label,
  emptyLabel,
  domain,
  ticks,
  valueFormatter,
  seriesLabels,
  metricLabels,
  dayLabel = 'Day',
  yAxisWidth = 32,
  className,
}: ComparisonAreaChartProps) {
  const gradientId = useId()
  const isCoarsePointer = useCoarsePointer()
  const trigger = isCoarsePointer ? 'click' : 'hover'

  const config: ChartConfig = useMemo(
    () => ({
      current: { label: seriesLabels.current, color: CURRENT_COLOR },
      previous: { label: seriesLabels.previous, color: PREVIOUS_COLOR },
    }),
    [seriesLabels.current, seriesLabels.previous],
  )

  if (points.length === 0) {
    return <p className="py-12 text-center text-xs text-qb-muted">{emptyLabel}</p>
  }

  const tickCount = Math.min(5, points.length)
  const xTickIds = Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, index) => {
        const pointIndex = Math.round((index * (points.length - 1)) / (tickCount - 1 || 1))
        return points[pointIndex]?.id
      }),
    ),
  ).filter((id): id is string => id !== undefined)
  const idToLabel = new Map(points.map((point) => [point.id, point.label]))

  return (
    <div
      data-slot="comparison-area-chart"
      data-touch-trigger={trigger}
      className={cn('relative h-full w-full', className)}
    >
      <ChartContainer
        config={config}
        initialDimension={{ width: 640, height: 224 }}
        className="aspect-auto h-full w-full"
      >
        <ComposedChart
          data={points as ComparisonAreaPoint[]}
          accessibilityLayer
          tabIndex={0}
          aria-label={label}
          className="touch-pan-y"
          margin={{ top: 16, right: 16, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.1} />
              <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} strokeDasharray="3 5" stroke="var(--qb-chart-grid)" />
          <YAxis
            domain={domain as [number, number]}
            ticks={ticks as number[]}
            width={yAxisWidth}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => valueFormatter(value)}
            tick={{ className: 'fill-qb-muted font-mono tabular-nums', fontSize: 11 }}
          />
          <XAxis
            dataKey="id"
            ticks={xTickIds as string[]}
            tickFormatter={(id: string) => idToLabel.get(id) ?? ''}
            axisLine={false}
            tickLine={false}
            tick={{ className: 'fill-qb-muted font-mono', fontSize: 11 }}
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
                    ? (tooltipProps.payload?.[0]?.payload as ComparisonAreaPoint | undefined)
                    : undefined
                }
                seriesLabels={seriesLabels}
                metricLabels={metricLabels}
                valueFormatter={valueFormatter}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="current"
            connectNulls
            stroke="var(--color-current)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 6, stroke: 'var(--color-current)', strokeWidth: 2.5, className: 'fill-qb-surface' }}
          />
          <Line
            type="monotone"
            dataKey="previous"
            connectNulls
            stroke="var(--color-previous)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 3, fill: 'var(--color-previous)', className: 'stroke-qb-surface' }}
            isAnimationActive={false}
          />
          <ActivePointAnnouncer points={points} seriesLabels={seriesLabels} valueFormatter={valueFormatter} />
        </ComposedChart>
      </ChartContainer>

      <ChartDataTable
        caption={label}
        rows={points}
        rowKey={(point) => point.id}
        columns={[
          { key: 'day', header: dayLabel, render: (point) => point.label },
          {
            key: 'current',
            header: seriesLabels.current,
            render: (point) => (point.current === null ? '—' : valueFormatter(point.current)),
          },
          {
            key: 'previous',
            header: seriesLabels.previous,
            render: (point) => (point.previous === null ? '—' : valueFormatter(point.previous)),
          },
          ...(metricLabels
            ? [
                {
                  key: 'runs',
                  header: metricLabels.runs,
                  render: (point: ComparisonAreaPoint) => point.runs ?? '—',
                },
                {
                  key: 'failedRuns',
                  header: metricLabels.failedRuns,
                  render: (point: ComparisonAreaPoint) => point.failedRuns ?? '—',
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}
