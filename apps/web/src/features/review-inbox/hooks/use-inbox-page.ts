'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { getInboxPage, type ReviewInboxFilters } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

export const INBOX_PAGE_SIZE = 50

export function useInboxPage(filters: ReviewInboxFilters) {
  const query = useInfiniteQuery({
    queryKey: reviewKeys.inbox(filters),
    queryFn: ({ pageParam, signal }) =>
      getInboxPage(filters, pageParam, INBOX_PAGE_SIZE, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return {
    proposals: query.data?.pages.flatMap((page) => page.items) ?? [],
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
