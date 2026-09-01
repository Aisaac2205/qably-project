'use client'

import { useQuery } from '@tanstack/react-query'
import { getRun, listRuns } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export function useRuns(projectId?: string) {
  const query = useQuery({
    queryKey: runKeys.list(projectId ?? 'all'),
    queryFn: ({ signal }) => listRuns(projectId, signal),
  })

  return {
    runs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useRun(runId: string) {
  const query = useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: ({ signal }) => getRun(runId, signal),
    enabled: runId !== '',
  })

  return {
    run: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
