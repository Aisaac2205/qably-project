'use client'

import { useState, useRef, useCallback } from 'react'
import { TraceabilityTooltip } from './traceability-tooltip'
import type {
  CalendarDayData,
  CalendarWeekData,
  CalendarMonthLabel,
  TooltipCoordinate,
} from '../types/traceability-calendar'

// SVG Grid Geometry (Exact GitHub Specifications)
const CELL_SIZE = 10
const CELL_GAP = 3
const CELL_RADIUS = 2
const STEP = CELL_SIZE + CELL_GAP // 13px
const LEFT_OFFSET = 30 // Space for Day labels (Lun, Mié, Vie)
const TOP_OFFSET = 20 // Space for Month labels (Ene, Feb, etc.)

// GitHub Contribution Palette (OKLCH tokens aligned with Qably design system)
const COLOR_LEVELS = [
  'var(--heatmap-l0, oklch(0.93 0.004 85))',
  'var(--heatmap-l1, oklch(0.85 0.09 145))',
  'var(--heatmap-l2, oklch(0.70 0.15 145))',
  'var(--heatmap-l3, oklch(0.56 0.18 145))',
  'var(--heatmap-l4, oklch(0.44 0.20 145))',
] as const

export interface TraceabilityCalendarProps {
  readonly weeks: readonly CalendarWeekData[]
  readonly monthLabels: readonly CalendarMonthLabel[]
  readonly year: number
  readonly locale?: 'es' | 'en'
  readonly lessLabel?: string
  readonly moreLabel?: string
  readonly footerNote?: string
}

interface HoveredState {
  readonly day: CalendarDayData
  readonly position: TooltipCoordinate
}

export function TraceabilityCalendar({
  weeks,
  monthLabels,
  year,
  locale = 'es',
  lessLabel = 'Menos',
  moreLabel = 'Más',
  footerNote,
}: TraceabilityCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredState, setHoveredState] = useState<HoveredState | null>(null)

  const svgWidth = LEFT_OFFSET + weeks.length * STEP + 10
  const svgHeight = TOP_OFFSET + 7 * STEP + 4

  const handleCellMouseEnter = useCallback(
    (day: CalendarDayData, event: React.MouseEvent<SVGRectElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()

      if (containerRect) {
        setHoveredState({
          day,
          position: {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top,
          },
        })
      }
    },
    [],
  )

  const handleCellMouseLeave = useCallback(() => {
    setHoveredState(null)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      {/* Tooltip Overlay without card movement */}
      <TraceabilityTooltip
        day={hoveredState?.day ?? null}
        position={hoveredState?.position ?? null}
      />

      {/* SVG Container with horizontal scroll on small devices */}
      <div className="overflow-x-auto pb-1 pt-1 scrollbar-thin">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-[700px] w-full select-none"
          role="img"
          aria-label={`Calendario de trazabilidad y gobernanza de ${year}`}
        >
          {/* Month Labels */}
          {monthLabels.map((month) => {
            const x = LEFT_OFFSET + month.weekIndex * STEP
            return (
              <text
                key={`${month.monthIndex}-${month.weekIndex}`}
                x={x}
                y={12}
                fontSize={10}
                fill="var(--color-muted)"
                className="font-medium"
              >
                {month.name}
              </text>
            )
          })}

          {/* Day of Week Labels (Mon, Wed, Fri) */}
          <text
            x={0}
            y={TOP_OFFSET + 1 * STEP + 8}
            fontSize={9}
            fill="var(--color-muted)"
            className="font-medium"
          >
            {locale === 'es' ? 'Lun' : 'Mon'}
          </text>
          <text
            x={0}
            y={TOP_OFFSET + 3 * STEP + 8}
            fontSize={9}
            fill="var(--color-muted)"
            className="font-medium"
          >
            {locale === 'es' ? 'Mié' : 'Wed'}
          </text>
          <text
            x={0}
            y={TOP_OFFSET + 5 * STEP + 8}
            fontSize={9}
            fill="var(--color-muted)"
            className="font-medium"
          >
            {locale === 'es' ? 'Vie' : 'Fri'}
          </text>

          {/* Contribution Cells */}
          {weeks.map((week) => {
            const colX = LEFT_OFFSET + week.weekIndex * STEP

            return (
              <g key={week.weekIndex} transform={`translate(${colX}, ${TOP_OFFSET})`}>
                {week.days.map((day, dayIndex) => {
                  if (!day) return null

                  const cellY = dayIndex * STEP
                  const fillColor = COLOR_LEVELS[day.level]
                  const isHovered = hoveredState?.day.date === day.date

                  return (
                    <rect
                      key={day.date}
                      x={0}
                      y={cellY}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={CELL_RADIUS}
                      ry={CELL_RADIUS}
                      fill={fillColor}
                      stroke={isHovered ? 'var(--color-primary)' : 'transparent'}
                      strokeWidth={1.5}
                      className="cursor-pointer transition-all duration-100 hover:opacity-85"
                      onMouseEnter={(e) => handleCellMouseEnter(day, e)}
                      onMouseLeave={handleCellMouseLeave}
                      role="gridcell"
                      aria-label={`${day.count} eventos de trazabilidad el ${day.formattedDate}`}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend & Footer */}
      <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        {footerNote ? (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="size-1.5 rounded-full bg-pass" />
            {footerNote}
          </span>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1.5 text-[11px]">
          <span>{lessLabel}</span>
          {COLOR_LEVELS.map((color, i) => (
            <span
              key={i}
              className="inline-block size-2.5 rounded-[2px] border border-border/40"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
          ))}
          <span>{moreLabel}</span>
        </div>
      </div>
    </div>
  )
}
