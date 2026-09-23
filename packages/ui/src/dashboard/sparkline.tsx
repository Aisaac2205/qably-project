'use client'

import { useId } from 'react'
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

export function Sparkline({ values, label, tone = 'primary', width = 72, height = 24, className }: SparklineProps) {
  const gradientId = useId()

  if (values.length < 2) return null

  const color = TONE_VAR[tone]
  const data = values.map((value, index) => ({ index, value }))
  const config: ChartConfig = { value: { color } }
  const lastDefinedIndex = data.reduce(
    (found, point, index) => (point.value !== null ? index : found),
    -1,
  )

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
