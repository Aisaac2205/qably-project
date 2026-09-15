'use client'

import { useId, useState } from 'react'
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

export interface TrendPoint {
  id: string
  label: string
  value: number
}

export interface TrendChartProps {
  points: readonly TrendPoint[]
  label: string
  emptyLabel: string
  valueFormatter?: (value: number) => string
  min?: number
  max?: number
  ticks?: readonly number[]
  className?: string
}

const WIDTH = 640
const HEIGHT = 200
const PLOT_LEFT = 40
const PLOT_RIGHT = WIDTH - 16
const PLOT_TOP = 14
const PLOT_BOTTOM = HEIGHT - 30
const Y_AXIS_WIDTH = PLOT_LEFT - 16
const X_AXIS_HEIGHT = HEIGHT - PLOT_BOTTOM
const MARKER_RADIUS = 4
const RING = 2

function defaultFormat(value: number): string {
  return String(value)
}

export function TrendChart({
  points,
  label,
  emptyLabel,
  valueFormatter = defaultFormat,
  min = 0,
  max = 100,
  ticks = [0, 50, 100],
  className,
}: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const tooltipId = useId()
  const gradientId = useId()

  if (points.length === 0) {
    return <p className="py-8 text-center text-xs text-qb-muted">{emptyLabel}</p>
  }

  const span = max - min || 1
  const xFor = (index: number) =>
    points.length === 1
      ? (PLOT_LEFT + PLOT_RIGHT) / 2
      : PLOT_LEFT + (index / (points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT)
  const yFor = (value: number) => PLOT_TOP + ((max - value) / span) * (PLOT_BOTTOM - PLOT_TOP)

  const coords = points.map((point, index) => ({ x: xFor(index), y: yFor(point.value) }))

  const middle = Math.floor((points.length - 1) / 2)
  const labelledIndexes = new Set([0, middle, points.length - 1])
  const slotWidth = points.length > 1 ? (PLOT_RIGHT - PLOT_LEFT) / (points.length - 1) : PLOT_RIGHT - PLOT_LEFT
  const activePoint = active === null ? null : points[active]
  const activeCoord = active === null ? null : coords[active]

  const chartData = points.map((point) => ({ id: point.id, label: point.label, value: point.value }))
  const xTicks = points
    .filter((_, index) => labelledIndexes.has(index))
    .map((point) => point.label)

  return (
    <div className={`relative ${className ?? ''}`}>
      <div className="qb-trend-chart-scale [&_.recharts-wrapper]:!w-full [&_.recharts-wrapper]:!h-44">
        <RechartsAreaChart
          width={WIDTH}
          height={HEIGHT}
          data={chartData}
          role="img"
          aria-label={label}
          accessibilityLayer={false}
          tabIndex={-1}
          margin={{ top: PLOT_TOP, right: WIDTH - PLOT_RIGHT, bottom: 0, left: PLOT_LEFT - Y_AXIS_WIDTH }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--qb-chart-line)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--qb-chart-line)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--qb-chart-grid)"
            strokeWidth={1}
          />
          <YAxis
            domain={[min, max]}
            ticks={ticks as number[]}
            width={Y_AXIS_WIDTH}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => valueFormatter(value)}
            tick={{ className: 'fill-qb-muted tabular-nums', fontSize: 10 }}
          />
          <XAxis
            dataKey="label"
            height={X_AXIS_HEIGHT}
            ticks={xTicks}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
            tick={{ className: 'fill-qb-muted', fontSize: 10 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--qb-chart-line)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={false}
            dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
              const isLast = dotProps.index === points.length - 1
              if (!isLast) {
                return <g key={`dot-${dotProps.index}`} />
              }
              return (
                <circle
                  key="marker"
                  data-marker=""
                  cx={dotProps.cx}
                  cy={dotProps.cy}
                  r={MARKER_RADIUS}
                  fill="var(--qb-chart-line)"
                  className="stroke-qb-surface"
                  strokeWidth={RING}
                />
              )
            }}
          />
        </RechartsAreaChart>
      </div>

      <div className="absolute inset-x-0 top-0 h-44">
        {points.map((point, index) => {
          const centre = ((xFor(index) - slotWidth / 2) / WIDTH) * 100
          const width = (slotWidth / WIDTH) * 100
          return (
            <button
              key={point.id}
              type="button"
              aria-label={`${point.label}: ${valueFormatter(point.value)}`}
              aria-describedby={active === index ? tooltipId : undefined}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="absolute inset-y-0 min-w-6 cursor-crosshair rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-qb-primary/40"
              style={{ left: `${Math.max(centre, 0)}%`, width: `${width}%` }}
            />
          )
        })}
      </div>

      {activePoint && activeCoord ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-qb-primary px-2.5 py-1.5 text-xs text-qb-primary-fg shadow-qb-pop"
          style={{ left: `${(activeCoord.x / WIDTH) * 100}%`, top: `${(activeCoord.y / HEIGHT) * 100}%` }}
        >
          <span className="block font-semibold tabular-nums">{valueFormatter(activePoint.value)}</span>
          <span className="block opacity-80">{activePoint.label}</span>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <th scope="row">{point.label}</th>
              <td>{valueFormatter(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
