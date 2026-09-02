'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'

export function useDashboardSummary(projectId?: string) {
  const query = useQuery({
    queryKey: dashboardKeys.summary(projectId ?? 'all'),
    queryFn: ({ signal }) => getDashboardSummary(projectId, signal),
  })

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
