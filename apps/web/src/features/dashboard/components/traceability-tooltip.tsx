'use client'

import { useTranslation } from '@/lib/i18n'
import type { CalendarDayData, TooltipCoordinate } from '../types/traceability-calendar'

export interface TraceabilityTooltipProps {
  readonly day: CalendarDayData | null
  readonly position: TooltipCoordinate | null
}

/**
 * Pixel-perfect, lightweight GitHub-style pill tooltip.
 * Renders absolutely above the hovered calendar cell without any layout shift.
 * Uses dynamic localization without hardcoded strings.
 */
export function TraceabilityTooltip({
  day,
  position,
}: TraceabilityTooltipProps) {
  const { t } = useTranslation()

  if (!day || !position) return null

  const message =
    day.count === 0
      ? t('dashboard.traceabilityDayEmpty', { date: day.formattedShortDate })
      : t('dashboard.traceabilityDayEvents', {
          count: day.count.toLocaleString(),
          date: day.formattedShortDate,
        })

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#24292f] px-2.5 py-1 text-xs font-medium text-white shadow-md dark:bg-[#2d333b] dark:text-[#f0f6fc]"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 7}px`,
      }}
    >
      {message}
    </div>
  )
}
