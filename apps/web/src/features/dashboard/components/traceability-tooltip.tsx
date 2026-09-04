'use client'

import { useTranslation } from '@/lib/i18n'
import type { CalendarDayData, TooltipCoordinate } from '../types/traceability-calendar'

export function describeDay(
  t: (key: string, params?: Record<string, string | number>) => string,
  day: CalendarDayData,
): string {
  if (day.count === 0) {
    return t('dashboard.traceabilityDayEmpty', { date: day.formattedShortDate })
  }

  if (day.count === 1) {
    return t('dashboard.traceabilityDayEvent', { date: day.formattedShortDate })
  }

  return t('dashboard.traceabilityDayEvents', {
    count: day.count,
    date: day.formattedShortDate,
  })
}

export interface TraceabilityTooltipProps {
  readonly day: CalendarDayData | null
  readonly position: TooltipCoordinate | null
}

export function TraceabilityTooltip({
  day,
  position,
}: TraceabilityTooltipProps) {
  const { t } = useTranslation()

  if (!day || !position) return null

  const message = describeDay(t, day)

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg shadow-pop"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 7}px`,
      }}
    >
      {message}
    </div>
  )
}
