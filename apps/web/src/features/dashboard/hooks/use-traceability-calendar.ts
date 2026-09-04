'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TraceabilityCalendarRecord } from '@qably/types'
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

function emptyRecord(year: number): TraceabilityCalendarRecord {
  return {
    year,
    timeZone: 'America/Guatemala',
    totals: { scm: 0, proposals: 0, official: 0, runs: 0 },
    days: [],
  }
}

export interface TraceabilityCalendarState extends TraceabilityCalendarData {
  readonly isLoading: boolean
  readonly isError: boolean
}

export function useTraceabilityCalendar({
  year = new Date().getFullYear(),
  activeFilter = 'all',
  locale = 'es',
  projectId,
}: UseTraceabilityCalendarOptions = {}): TraceabilityCalendarState {
  const query = useQuery({
    queryKey: dashboardKeys.traceability(year, projectId ?? 'all'),
    queryFn: ({ signal }) => getTraceabilityCalendar(year, projectId, signal),
  })

  const record = query.data ?? emptyRecord(year)

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
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
