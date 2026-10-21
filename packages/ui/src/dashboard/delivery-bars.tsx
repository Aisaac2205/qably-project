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
  /**
   * BCP 47 tag for the tooltip date. Without one the tooltip follows the
   * language of the page (`<html lang>`), then the browser's.
   */
  locale?: string
  className?: string
}

const MAX_BAR_HEIGHT = 26
const MIN_BAR_HEIGHT = 4

function barTone(point: DeliveryBarPoint): string {
  if (point.failed > 0) return 'bg-qb-fail'
  if (point.sent > 0) return 'bg-qb-fg'
  return 'bg-qb-border'
}

function pageLocale(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.documentElement.lang || undefined
}

function formatShortDate(date: Date, locale: string | undefined): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' }

  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    // A malformed tag throws a RangeError: show the date in the runtime default.
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}

/**
 * "4 Sep" / "Sep 4" for a `YYYY-MM-DD` day, in the active language. A day is a
 * calendar date, not an instant: it is built and printed in UTC so a viewer west
 * of Greenwich never sees the day before. Anything else is shown as it came,
 * rather than guessed at.
 */
function formatDateShort(dateStr: string, locale: string | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (match === null) return dateStr

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDay =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day

  return isRealDay ? formatShortDate(date, locale) : dateStr
}

export function DeliveryBars({
  points,
  label,
  emptyLabel = label,
  sentLabel = 'Sent',
  failedLabel = 'Failed',
  locale,
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
          <span className="font-mono opacity-80">{formatDateShort(activePoint.date, locale ?? pageLocale())}</span>
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
