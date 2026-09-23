import type {
  DashboardChannelsRecord,
  DashboardOverviewRecord,
  DashboardPeriod,
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
  tz: string,
  projectId?: string,
  signal?: AbortSignal,
): Promise<TraceabilityCalendarRecord> {
  const params = new URLSearchParams({ year: String(year), tz })
  if (projectId !== undefined) params.set('projectId', projectId)

  return apiRequest<TraceabilityCalendarRecord>(
    `/dashboard/traceability?${params.toString()}`,
    { signal },
  )
}

export function getDashboardOverview(
  period: DashboardPeriod,
  tz: string,
  projectId?: string,
  signal?: AbortSignal,
): Promise<DashboardOverviewRecord> {
  const params = new URLSearchParams({ period: String(period), tz })
  if (projectId !== undefined) params.set('projectId', projectId)

  return apiRequest<DashboardOverviewRecord>(
    `/dashboard/overview?${params.toString()}`,
    { signal },
  )
}

export function getDashboardChannels(
  tz: string,
  signal?: AbortSignal,
): Promise<DashboardChannelsRecord> {
  const params = new URLSearchParams({ tz })

  return apiRequest<DashboardChannelsRecord>(
    `/dashboard/channels?${params.toString()}`,
    { signal },
  )
}
