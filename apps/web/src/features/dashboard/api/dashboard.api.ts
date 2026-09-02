import type { DashboardSummaryRecord } from '@qably/types'
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
