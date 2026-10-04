'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import { getCiRun, listCiRuns } from '../api/ci-runs.api'
import { ciRunKeys } from '../lib/query-keys'

export const CI_RUNS_PAGE_SIZE = 25
const CI_RUN_RETRIES = 1

export function useCiRunsPage(projectId: string) {
  const query = useInfiniteQuery({
    queryKey: ciRunKeys.page(projectId),
    queryFn: ({ pageParam, signal }) =>
      listCiRuns({ projectId, limit: CI_RUNS_PAGE_SIZE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return {
    ciRuns: query.data?.pages.flatMap((page) => page.items) ?? [],
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

function retryUnlessNotFound(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === 404) return false
  return failureCount < CI_RUN_RETRIES
}

export function useCiRun(id: string | undefined) {
  const resolvedId = id ?? ''

  const query = useQuery({
    queryKey: ciRunKeys.detail(resolvedId),
    queryFn: ({ signal }) => getCiRun(resolvedId, signal),
    enabled: resolvedId !== '',
    retry: retryUnlessNotFound,
  })

  return {
    ciRun: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
