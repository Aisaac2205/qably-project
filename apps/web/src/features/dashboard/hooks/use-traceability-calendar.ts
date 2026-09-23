'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TraceabilityCalendarRecord } from '@qably/types'
import { useBrowserTimeZone } from '@/lib/time-zone'
import { getTraceabilityCalendar } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'
import { buildTraceabilityGrid } from '../lib/traceability-grid'
import type {
  TraceabilityCalendarData,
  UseTraceabilityCalendarOptions,
} from '../types/traceability-calendar'

const MONTH_NAMES = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const

function emptyRecord(year: number, timeZone: string): TraceabilityCalendarRecord {
  return {
    year,
    timeZone,
    totals: { scm: 0, proposals: 0, official: 0, runs: 0 },
    days: [],
  }
}

export interface TraceabilityCalendarState extends TraceabilityCalendarData {
  readonly isLoading: boolean
  readonly isError: boolean
  readonly retry: () => void
}

export function useTraceabilityCalendar({
  year = new Date().getFullYear(),
  activeFilter = 'all',
  locale = 'es',
  projectId,
}: UseTraceabilityCalendarOptions = {}): TraceabilityCalendarState {
  const tz = useBrowserTimeZone()

  const query = useQuery({
    queryKey: dashboardKeys.traceability(year, projectId ?? 'all', tz),
    queryFn: ({ signal }) => {
      if (tz === undefined) {
        return Promise.reject(new Error('browser time zone not resolved yet'))
      }
      return getTraceabilityCalendar(year, tz, projectId, signal)
    },
    enabled: tz !== undefined,
  })

  const record = query.data ?? emptyRecord(year, tz ?? 'UTC')

  const grid = useMemo(
    () => buildTraceabilityGrid(record, activeFilter, MONTH_NAMES[locale], locale),
    [record, activeFilter, locale],
  )

  return {
    year: grid.year,
    totalEvents: grid.totalEvents,
    weeks: grid.weeks,
    monthLabels: grid.monthLabels,
    breakdownTotals: grid.breakdownTotals,
    activeFilter,
    isLoading: tz === undefined || query.isLoading,
    isError: query.isError,
    retry: () => {
      void query.refetch()
    },
  }
}
