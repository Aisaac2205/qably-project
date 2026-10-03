'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { listCiRuns } from '../api/ci-runs.api'
import { ciRunKeys } from '../lib/query-keys'

export const CI_RUNS_PAGE_SIZE = 25

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
