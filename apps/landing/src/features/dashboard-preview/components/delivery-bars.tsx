import React, { useRef, useState, useCallback, useEffect } from 'react'
import { PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
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
  if (point.failed > 0) return 'bg-fail'
  if (point.sent > 0) return 'bg-default'
  return 'bg-border'
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

  const maxVolume = Math.max(1, ...points.map((p) => p.sent + p.failed))

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    }
  }, [])

  const handleTouch = useCallback((index: number) => {
    setHoveredIndex(index)
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    touchTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(null)
    }, 2000)
  }, [])

  const tableRows: readonly [string, number][] = points.map((p) => [
    formatDateShort(p.date),
    p.sent + p.failed,
  ])

  return (
    <div
      ref={containerRef}
      className={cn('relative flex items-end gap-1 select-none', className)}
      onMouseLeave={() => setHoveredIndex(null)}
      role="region"
      aria-label={label}
    >
      <ChartDataTable caption={label} headers={['Date', 'Deliveries']} rows={tableRows} />

      {points.map((point, index) => {
        const total = point.sent + point.failed
        const rawHeight = total > 0 ? (total / maxVolume) * MAX_BAR_HEIGHT : MIN_BAR_HEIGHT
        const height = Math.max(MIN_BAR_HEIGHT, Math.min(MAX_BAR_HEIGHT, Math.round(rawHeight)))
        const isHovered = hoveredIndex === index

        return (
          <div
            key={point.date}
            className="group relative flex flex-1 items-end justify-center"
            style={{ height: MAX_BAR_HEIGHT }}
            onMouseEnter={() => setHoveredIndex(index)}
            onTouchStart={() => handleTouch(index)}
          >
            <div
              className={cn(
                'w-full max-w-1.5 rounded-sm transition-all duration-150',
                barTone(point),
                isHovered && 'brightness-125 scale-y-105',
              )}
              style={{ height }}
            />

            {isHovered && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-default shadow-pop"
              >
                <p className="text-muted text-[10px]">{formatDateShort(point.date)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1">
                    <PaperPlaneTilt size={10} className="text-muted" aria-hidden="true" />
                    <span>{point.sent} {sentLabel}</span>
                  </span>
                  {point.failed > 0 && (
                    <span className="flex items-center gap-1 text-fail font-semibold">
                      <WarningCircle size={10} aria-hidden="true" />
                      <span>{point.failed} {failedLabel}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
