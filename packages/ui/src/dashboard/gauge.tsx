'use client'

import type { ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { cn } from '../utils'

export interface GaugeProps {
  value: number | null
  label: string
  size?: number
  className?: string
  children?: ReactNode
}

const START_ANGLE = 180
const END_ANGLE = 0
const OUTER_RADIUS = 56
const INNER_RADIUS = 42
const CORNER_RADIUS = 6

export function Gauge({ value, label, size = 128, className, children }: GaugeProps) {
  const clamped = value === null ? null : Math.min(100, Math.max(0, value))
  const trackData = [{ segment: 'track', portion: 100 }]
  const valueData = clamped === null ? [] : [
    { segment: 'value', portion: clamped },
    { segment: 'rest', portion: 100 - clamped },
  ]

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size / 2 + 8 }}
    >
      <PieChart width={size} height={size / 2 + 8} accessibilityLayer={false} tabIndex={-1}>
        <Pie
          data={trackData}
          dataKey="portion"
          nameKey="segment"
          cx="50%"
          cy="100%"
          startAngle={START_ANGLE}
          endAngle={END_ANGLE}
          innerRadius={INNER_RADIUS}
          outerRadius={OUTER_RADIUS}
          isAnimationActive={false}
          stroke="none"
        >
          <Cell className="fill-qb-canvas-hover" />
        </Pie>
        {clamped !== null ? (
          <Pie
            data={valueData}
            dataKey="portion"
            nameKey="segment"
            cx="50%"
            cy="100%"
            startAngle={START_ANGLE}
            endAngle={END_ANGLE}
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            cornerRadius={CORNER_RADIUS}
            isAnimationActive={false}
            stroke="none"
          >
            <Cell fill="var(--qb-chart-pass)" />
            <Cell fill="transparent" />
          </Pie>
        ) : null}
      </PieChart>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-0.5 text-center">
        {children}
      </div>
    </div>
  )
}
