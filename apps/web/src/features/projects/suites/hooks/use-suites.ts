'use client'

import { useQuery } from '@tanstack/react-query'
import type { Suite } from '@qably/types'
import { getSuite, listSuites } from '../api/suites.api'
import { suiteKeys } from '../../lib/query-keys'

export type SuiteRefetchInterval =
  | number
  | false
  | ((suite: Suite | undefined) => number | false)

export type SuitesRefetchInterval =
  | number
  | false
  | ((suites: Suite[] | undefined) => number | false)

export function useSuites(projectId?: string, refetchInterval: SuitesRefetchInterval = false) {
  const query = useQuery({
    queryKey: suiteKeys.list(projectId ?? 'all'),
    queryFn: ({ signal }) => listSuites(projectId, signal),
    refetchInterval:
      typeof refetchInterval === 'function'
        ? (query) => refetchInterval(query.state.data)
        : refetchInterval,
  })

  return {
    suites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useSuite(
  suiteId: string,
  refetchInterval: SuiteRefetchInterval = false,
) {
  const query = useQuery({
    queryKey: suiteKeys.detail(suiteId),
    queryFn: ({ signal }) => getSuite(suiteId, signal),
    enabled: suiteId !== '',
    refetchInterval:
      typeof refetchInterval === 'function'
        ? (query) => refetchInterval(query.state.data)
        : refetchInterval,
  })

  return {
    suite: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
