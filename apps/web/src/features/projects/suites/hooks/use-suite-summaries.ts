'use client'

import { useCallback } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type PlaceholderDataFunction,
} from '@tanstack/react-query'
import type { SuiteSummariesPage, SuiteSummary } from '@qably/types'
import { listSuiteSummaries, listSuiteTags } from '../api/suites.api'
import { suiteKeys } from '../../lib/query-keys'
import { toSuiteSummariesQuery, type SuiteSummariesFilters } from '../lib/suite-summaries-query'

export const SUITE_SUMMARIES_PAGE_SIZE = 50

type SummariesData = InfiniteData<SuiteSummariesPage, string | undefined>
type SummaryPageKey = ReturnType<typeof suiteKeys.summaryPage>

const NO_SUITES: SuiteSummary[] = []
const NO_TAGS: string[] = []

function flattenSummaries(data: SummariesData): SuiteSummary[] {
  const seen = new Set<string>()
  const rows: SuiteSummary[] = []

  for (const page of data.pages) {
    for (const item of page.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        rows.push(item)
      }
    }
  }

  return rows
}

export function useSuiteSummaries(projectId: string, filters: SuiteSummariesFilters) {
  const query = toSuiteSummariesQuery(filters)
  const keepPreviousOfProject = useCallback<
    PlaceholderDataFunction<SummariesData, Error, SummariesData, SummaryPageKey>
  >(
    (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === projectId ? previousData : undefined,
    [projectId],
  )

  const result = useInfiniteQuery({
    queryKey: suiteKeys.summaryPage(projectId, query),
    queryFn: ({ pageParam, signal }) =>
      listSuiteSummaries(
        { projectId, ...query, cursor: pageParam, limit: SUITE_SUMMARIES_PAGE_SIZE },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousOfProject,
    select: flattenSummaries,
  })

  return {
    suites: result.data ?? NO_SUITES,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: result.fetchNextPage,
    isLoading: result.isLoading,
    isLoadingError: result.isLoadingError,
    isFetchNextPageError: result.isFetchNextPageError,
    isPlaceholderData: result.isPlaceholderData,
    refetch: result.refetch,
  }
}

export function useSuiteTags(projectId: string) {
  const result = useQuery({
    queryKey: suiteKeys.tags(projectId),
    queryFn: ({ signal }) => listSuiteTags(projectId, signal),
  })

  return {
    tags: result.data?.items ?? NO_TAGS,
    isLoading: result.isLoading,
    isError: result.isError,
  }
}
