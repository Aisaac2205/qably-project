import type {
  DashboardSummaryRecord,
  TraceabilityCalendarRecord,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function getDashboardSummary(
  projectId?: string,
  signal?: AbortSignal,
): Promise<DashboardSummaryRecord> {
  const query =
    projectId === undefined
      ? ''
      : `?projectId=${encodeURIComponent(projectId)}`

  return apiRequest<DashboardSummaryRecord>(`/dashboard/summary${query}`, {
    signal,
  })
}

export function getTraceabilityCalendar(
  year: number,
  projectId?: string,
  signal?: AbortSignal,
): Promise<TraceabilityCalendarRecord> {
  const params = new URLSearchParams({ year: String(year) })
  if (projectId !== undefined) params.set('projectId', projectId)

  return apiRequest<TraceabilityCalendarRecord>(
    `/dashboard/traceability?${params.toString()}`,
    { signal },
  )
}
