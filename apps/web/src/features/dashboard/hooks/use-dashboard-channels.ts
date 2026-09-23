'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardChannelsRecord } from '@qably/types'
import { useBrowserTimeZone } from '@/lib/time-zone'
import { getDashboardChannels } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'

export interface DashboardChannelsState {
  readonly channels: DashboardChannelsRecord | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly retry: () => void
}

export function useDashboardChannels(): DashboardChannelsState {
  const tz = useBrowserTimeZone()

  const query = useQuery({
    queryKey: dashboardKeys.channels(tz),
    queryFn: ({ signal }) => {
      if (tz === undefined) {
        return Promise.reject(new Error('browser time zone not resolved yet'))
      }
      return getDashboardChannels(tz, signal)
    },
    enabled: tz !== undefined,
  })

  return {
    channels: query.data,
    isLoading: tz === undefined || query.isLoading,
    isError: query.isError,
    retry: () => {
      void query.refetch()
    },
  }
}
