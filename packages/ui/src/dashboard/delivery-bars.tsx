'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import { cn } from '../utils'
import { ChartDataTable } from './chart-data-table'

export interface DeliveryBarPoint {
  date: string
  sent: number
  failed: number
}

export interface DeliveryBarsProps {
  points: readonly DeliveryBarPoint[]
  label: string
  emptyLabel?: string
  sentLabel?: string
  failedLabel?: string
  className?: string
}

const MAX_BAR_HEIGHT = 26
const MIN_BAR_HEIGHT = 4

function barTone(point: DeliveryBarPoint): string {
  if (point.failed > 0) return 'bg-qb-fail'
  if (point.sent > 0) return 'bg-qb-fg'
  return 'bg-qb-border'
}

function formatDateShort(dateStr: string): string {
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      const monthIdx = Number(parts[1]) - 1
      const day = Number(parts[2])
      if (monthIdx >= 0 && monthIdx < 12 && !Number.isNaN(day)) {
        return `${day} ${months[monthIdx]}`
      }
    }
  } catch {
    // fallback
  }
  return dateStr
}

export function DeliveryBars({
  points,
  label,
  emptyLabel = label,
  sentLabel = 'Sent',
  failedLabel = 'Failed',
  className,
}: DeliveryBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0]
      if (!touch || !containerRef.current || points.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const barWidth = rect.width / points.length
      const index = Math.max(0, Math.min(points.length - 1, Math.floor(x / barWidth)))
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
      setHoveredIndex(index)
    },
    [points.length],
  )

  const handleTouchEnd = useCallback(() => {
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    touchTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(null)
    }, 1200)
  }, [])

  if (points.length === 0) {
    return <p className="py-4 text-center text-xs text-qb-muted">{emptyLabel}</p>
  }

  const max = Math.max(1, ...points.map((point) => point.sent))
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null

  // Clamp tooltip horizontal position so it stays gracefully within view
  const tooltipLeftPercent =
    hoveredIndex !== null && points.length > 1
      ? Math.max(20, Math.min(80, (hoveredIndex / (points.length - 1)) * 100))
      : 50

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      {activePoint && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-8 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[10px] font-medium text-background shadow-md transition-all duration-150 ease-out animate-in fade-in-0 zoom-in-95"
          style={{ left: `${tooltipLeftPercent}%` }}
        >
          <span className="font-mono opacity-80">{formatDateShort(activePoint.date)}</span>
          <span className="inline-flex items-center gap-0.5 text-status-pass font-semibold">
            <PaperPlaneTilt size={10} weight="bold" aria-hidden="true" />
            <span className="font-mono tabular-nums">{activePoint.sent}</span>
          </span>
          {activePoint.failed > 0 && (
            <span className="inline-flex items-center gap-0.5 text-status-fail font-semibold">
              <WarningCircle size={10} weight="bold" aria-hidden="true" />
              <span className="font-mono tabular-nums">{activePoint.failed}</span>
            </span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex h-7 items-end gap-0.5 select-none"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHoveredIndex(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {points.map((point, index) => {
          const height =
            point.sent === 0 ? MIN_BAR_HEIGHT : Math.max(MIN_BAR_HEIGHT, Math.round((point.sent / max) * MAX_BAR_HEIGHT))
          const isHovered = hoveredIndex === index
          const isAnyHovered = hoveredIndex !== null

          return (
            <div
              key={point.date}
              data-slot="delivery-bar"
              className={cn(
                'w-1 shrink-0 rounded-sm cursor-pointer origin-bottom transition-all duration-150 ease-out',
                barTone(point),
                isHovered && 'scale-y-125 scale-x-125 brightness-125 z-10 shadow-xs',
                isAnyHovered && !isHovered && 'opacity-50',
              )}
              style={{ height }}
              onMouseEnter={() => setHoveredIndex(index)}
              onTouchStart={() => {
                if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
                setHoveredIndex(index)
              }}
            />
          )
        })}
      </div>
      <ChartDataTable
        caption={label}
        rows={points}
        rowKey={(point) => point.date}
        columns={[
          { key: 'date', header: 'Date', render: (point) => point.date },
          { key: 'sent', header: sentLabel, render: (point) => point.sent },
          { key: 'failed', header: failedLabel, render: (point) => point.failed },
        ]}
      />
    </div>
  )
}
