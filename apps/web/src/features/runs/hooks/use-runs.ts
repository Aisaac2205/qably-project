'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { RunSource } from '@qably/types'
import {
  getPushPassRate,
  getRegressions,
  getRun,
  getSuiteMetrics,
  listRuns,
} from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export const RUNS_PAGE_SIZE = 25

export function useRunsPage(projectId: string, source?: RunSource) {
  const query = useInfiniteQuery({
    queryKey: runKeys.page(projectId, source ?? 'all'),
    queryFn: ({ pageParam, signal }) =>
      listRuns(
        { projectId, source, limit: RUNS_PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return {
    runs: query.data?.pages.flatMap((page) => page.items) ?? [],
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function usePushPassRate(projectId: string, days: number) {
  const query = useQuery({
    queryKey: runKeys.pushPassRate(projectId, days),
    queryFn: ({ signal }) => getPushPassRate(projectId, days, signal),
    enabled: projectId !== '',
  })

  return {
    candles: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useSuiteMetricsQuery(projectId: string) {
  const query = useQuery({
    queryKey: runKeys.suiteMetrics(projectId),
    queryFn: ({ signal }) => getSuiteMetrics(projectId, signal),
    enabled: projectId !== '',
  })

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useRegressions(projectId: string, limit = 20) {
  const query = useQuery({
    queryKey: runKeys.regressions(projectId, limit),
    queryFn: ({ signal }) => getRegressions(projectId, limit, signal),
    enabled: projectId !== '',
  })

  return {
    regressions: query.data?.items ?? [],
    runsScanned: query.data?.runsScanned ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
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
