'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { RunSource } from '@qably/types'
import { getRun, listRuns } from '../api/runs.api'
import { runKeys } from '../lib/query-keys'

export const RUNS_PAGE_SIZE = 25

export function useRuns(projectId?: string) {
  const query = useQuery({
    queryKey: runKeys.list(projectId ?? 'all'),
    queryFn: ({ signal }) => listRuns({ projectId }, signal),
  })

  return {
    runs: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

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
