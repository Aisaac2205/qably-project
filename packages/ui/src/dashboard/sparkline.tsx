'use client'

import { useId, useMemo } from 'react'
import { Area, ComposedChart, YAxis } from 'recharts'
import { cn } from '../utils'
import { ChartContainer, type ChartConfig } from '../chart/chart'

export type SparklineTone = 'pass' | 'fail' | 'muted' | 'primary' | 'warn'

const TONE_VAR: Record<SparklineTone, `var(--qb-chart-${string})`> = {
  primary: 'var(--qb-chart-line)',
  muted: 'var(--qb-chart-compare)',
  pass: 'var(--qb-chart-pass)',
  fail: 'var(--qb-chart-fail)',
  warn: 'var(--qb-chart-warn)',
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
const INSET = 3
const MIN_SPAN_PAD = 1
const SPAN_PAD_RATIO = 0.15

function computeSparklineDomain(values: readonly (number | null)[]): [number, number] {
  const defined = values.filter((value): value is number => value !== null)
  if (defined.length === 0) return [0, 1]

  const min = Math.min(...defined)
  const max = Math.max(...defined)
  const span = max - min
  const pad = span === 0 ? Math.max(Math.abs(min) * SPAN_PAD_RATIO, MIN_SPAN_PAD) : span * SPAN_PAD_RATIO

  return [min - pad, max + pad]
}

export function Sparkline({
  values,
  label,
  tone = 'primary',
  width = 96,
  height = 44,
  className,
  emptyLabel,
}: SparklineProps) {
  const gradientId = useId()
  const color = TONE_VAR[tone]
  const data = useMemo(() => values.map((value, index) => ({ index, value })), [values])
  const config: ChartConfig = useMemo(() => ({ value: { color } }), [color])
  const domain = useMemo(() => computeSparklineDomain(values), [values])
  const definedIndexes = useMemo(
    () => data.reduce<number[]>((found, point) => (point.value !== null ? [...found, point.index] : found), []),
    [data],
  )

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
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis type="number" domain={domain} hide />
        <Area
          type="monotone"
          dataKey="value"
          connectNulls
          stroke="var(--color-value)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          activeDot={false}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
