'use client'

import { useQuery } from '@tanstack/react-query'
import { getSuite, listSuites } from '../api/suites.api'
import { suiteKeys } from '../../lib/query-keys'

export function useSuites(projectId?: string) {
  const query = useQuery({
    queryKey: suiteKeys.list(projectId ?? 'all'),
    queryFn: ({ signal }) => listSuites(projectId, signal),
  })

  return {
    suites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useSuite(suiteId: string) {
  const query = useQuery({
    queryKey: suiteKeys.detail(suiteId),
    queryFn: ({ signal }) => getSuite(suiteId, signal),
    enabled: suiteId !== '',
  })

  return {
    suite: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
