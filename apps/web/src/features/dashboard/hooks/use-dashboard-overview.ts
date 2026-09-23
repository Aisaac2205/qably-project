'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardOverviewRecord, DashboardPeriod } from '@qably/types'
import { useBrowserTimeZone } from '@/lib/time-zone'
import { getDashboardOverview } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'

export interface DashboardOverviewState {
  readonly overview: DashboardOverviewRecord | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly retry: () => void
}

export function useDashboardOverview(
  period: DashboardPeriod,
  projectId?: string,
): DashboardOverviewState {
  const tz = useBrowserTimeZone()

  const query = useQuery({
    queryKey: dashboardKeys.overview(period, projectId ?? 'all', tz),
    queryFn: ({ signal }) => {
      if (tz === undefined) {
        return Promise.reject(new Error('browser time zone not resolved yet'))
      }
      return getDashboardOverview(period, tz, projectId, signal)
    },
    enabled: tz !== undefined,
  })

  return {
    overview: query.data,
    isLoading: tz === undefined || query.isLoading,
    isError: query.isError,
    retry: () => {
      void query.refetch()
    },
  }
}
