'use client'

import { useId, useMemo } from 'react'
import { Area, ComposedChart } from 'recharts'
import { cn } from '../utils'
import { ChartContainer, type ChartConfig } from '../chart/chart'

export type SparklineTone = 'pass' | 'fail' | 'muted' | 'primary'

const TONE_VAR: Record<SparklineTone, `var(--qb-chart-${string})`> = {
  primary: 'var(--qb-chart-line)',
  muted: 'var(--qb-chart-compare)',
  pass: 'var(--qb-chart-pass)',
  fail: 'var(--qb-chart-fail)',
}

export interface SparklineProps {
  values: readonly (number | null)[]
  label: string
  tone?: SparklineTone
  width?: number
  height?: number
  className?: string
  emptyLabel?: string
}

const MARKER_RADIUS = 4
const RING = 2
const INSET = MARKER_RADIUS + RING

interface SparkDotProps {
  cx?: number
  cy?: number
  index?: number
  value?: number | null
}

export function Sparkline({
  values,
  label,
  tone = 'primary',
  width = 72,
  height = 24,
  className,
  emptyLabel,
}: SparklineProps) {
  const gradientId = useId()
  const color = TONE_VAR[tone]
  const data = useMemo(() => values.map((value, index) => ({ index, value })), [values])
  const config: ChartConfig = useMemo(() => ({ value: { color } }), [color])
  const definedIndexes = useMemo(
    () => data.reduce<number[]>((found, point) => (point.value !== null ? [...found, point.index] : found), []),
    [data],
  )
  const lastDefinedIndex = definedIndexes.length ? definedIndexes[definedIndexes.length - 1] : -1

  if (definedIndexes.length === 0) {
    return (
      <span
        role="img"
        aria-label={emptyLabel ?? label}
        className={cn('inline-block', className)}
        style={{ width, height }}
      />
    )
  }

  if (definedIndexes.length === 1) {
    return (
      <svg role="img" aria-label={label} width={width} height={height} className={className}>
        <circle cx={width / 2} cy={height / 2} r={MARKER_RADIUS} fill={color} />
      </svg>
    )
  }

  return (
    <ChartContainer
      config={config}
      initialDimension={{ width, height }}
      width={width}
      height={height}
      className={cn('aspect-auto', className)}
      style={{ width, height }}
    >
      <ComposedChart
        data={data}
        role="img"
        aria-label={label}
        accessibilityLayer={false}
        tabIndex={-1}
        margin={{ top: INSET, right: INSET, bottom: INSET, left: INSET }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          connectNulls={false}
          stroke="var(--color-value)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          activeDot={false}
          dot={(dotProps: SparkDotProps) => {
            if (dotProps.index !== lastDefinedIndex) {
              return <g key={`dot-${dotProps.index}`} />
            }
            return (
              <circle
                key="marker"
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={MARKER_RADIUS}
                fill="var(--color-value)"
                className="stroke-qb-surface"
                strokeWidth={RING}
              />
            )
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
