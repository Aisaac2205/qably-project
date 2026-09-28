'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DashboardOverviewRecord, DashboardPeriod } from '@qably/types'
import { useBrowserTimeZone } from '@/lib/time-zone'
import { getDashboardOverview } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'

export interface DashboardOverviewState {
  readonly overview: DashboardOverviewRecord | undefined
  readonly isLoading: boolean
  readonly isRefreshing: boolean
  readonly isError: boolean
  readonly retry: () => void
}

export function useDashboardOverview(
  period: DashboardPeriod,
  projectId?: string,
): DashboardOverviewState {
  const tz = useBrowserTimeZone()

  const queryKey = dashboardKeys.overview(period, projectId ?? 'all', tz)

  const query = useQuery<
    DashboardOverviewRecord,
    Error,
    DashboardOverviewRecord,
    typeof queryKey
  >({
    queryKey,
    queryFn: async ({ signal }) => {
      if (tz === undefined) {
        throw new Error('browser time zone not resolved yet')
      }
      return getDashboardOverview(period, tz, projectId, signal)
    },
    enabled: tz !== undefined,
    placeholderData: keepPreviousData,
  })

  return {
    overview: query.data,
    isLoading: tz === undefined || (query.isLoading && query.data === undefined),
    isRefreshing: query.isPlaceholderData || query.isFetching,
    isError: query.isError,
    retry: () => {
      void query.refetch()
    },
  }
}
