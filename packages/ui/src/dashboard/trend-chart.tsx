'use client'

import { useId, useState } from 'react'

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
  const linePath = coords
    .map((c, index) => `${index === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(' ')
  const last = coords[coords.length - 1] as { x: number; y: number }
  const first = coords[0] as { x: number; y: number }
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${PLOT_BOTTOM} L ${first.x.toFixed(2)} ${PLOT_BOTTOM} Z`

  const middle = Math.floor((points.length - 1) / 2)
  const labelledIndexes = new Set([0, middle, points.length - 1])
  const slotWidth = points.length > 1 ? (PLOT_RIGHT - PLOT_LEFT) / (points.length - 1) : PLOT_RIGHT - PLOT_LEFT
  const activePoint = active === null ? null : points[active]
  const activeCoord = active === null ? null : coords[active]

  return (
    <div className={`relative ${className ?? ''}`}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-44 w-full"
      >
        {ticks.map((tick) => {
          const y = yFor(tick)
          return (
            <g key={tick}>
              <line
                data-grid=""
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--qb-chart-grid)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PLOT_LEFT - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                className="fill-qb-muted tabular-nums"
              >
                {valueFormatter(tick)}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill="var(--qb-chart-line)" fillOpacity={0.08} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--qb-chart-line)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {activeCoord ? (
          <line
            x1={activeCoord.x}
            x2={activeCoord.x}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke="var(--qb-chart-grid)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <circle
          data-marker=""
          cx={last.x}
          cy={last.y}
          r={MARKER_RADIUS}
          fill="var(--qb-chart-line)"
          className="stroke-qb-surface"
          strokeWidth={RING}
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) =>
          labelledIndexes.has(index) ? (
            <text
              key={point.id}
              x={xFor(index)}
              y={HEIGHT - 10}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fontSize={10}
              className="fill-qb-muted"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

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
