'use client'

import type { ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { cn } from '../utils'

export interface GaugeProps {
  value: number | null
  label: string
  width?: number
  height?: number
  className?: string
  children?: ReactNode
}

const START_ANGLE = 180
const END_ANGLE = 0
const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 132
const STROKE_WIDTH = 18
const EDGE_MARGIN = 16
const CORNER_RADIUS = STROKE_WIDTH / 2

export function Gauge({
  value,
  label,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
  children,
}: GaugeProps) {
  const clamped = value === null ? null : Math.min(100, Math.max(0, value))
  const outerRadius = width / 2 - EDGE_MARGIN
  const innerRadius = outerRadius - STROKE_WIDTH
  const trackData = [{ segment: 'track', portion: 100 }]
  const valueData = clamped === null ? [] : [
    { segment: 'value', portion: clamped },
    { segment: 'rest', portion: 100 - clamped },
  ]
  const a11yProps =
    clamped === null
      ? ({ role: 'img', 'aria-label': label } as const)
      : ({
          role: 'meter',
          'aria-label': label,
          'aria-valuenow': clamped,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuetext': label,
        } as const)

  return (
    <div
      {...a11yProps}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width, height }}
    >
      <PieChart width={width} height={height} accessibilityLayer={false} tabIndex={-1}>
        <Pie
          data={trackData}
          dataKey="portion"
          nameKey="segment"
          cx="50%"
          cy="100%"
          startAngle={START_ANGLE}
          endAngle={END_ANGLE}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
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
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            cornerRadius={CORNER_RADIUS}
            isAnimationActive={false}
            stroke="none"
          >
            <Cell fill="var(--qb-chart-line)" />
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
