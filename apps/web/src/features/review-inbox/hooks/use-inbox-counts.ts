'use client'

import { useQuery } from '@tanstack/react-query'
import {
  getInboxCounts,
  type ReviewInboxCountsFilters,
  type ReviewInboxStatusCounts,
} from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

const POLL_INTERVAL_MS = 15000

const EMPTY_COUNTS: ReviewInboxStatusCounts = {
  in_review: 0,
  approved: 0,
  rejected: 0,
  changes_requested: 0,
}

export function inboxCountsRefetchInterval(query: {
  state: { status: string }
}): number | false {
  return query.state.status === 'error' ? false : POLL_INTERVAL_MS
}

export function useInboxCounts(filters: ReviewInboxCountsFilters) {
  const query = useQuery({
    queryKey: reviewKeys.inboxCounts(filters),
    queryFn: ({ signal }) => getInboxCounts(filters, signal),
    refetchInterval: inboxCountsRefetchInterval,
  })

  return {
    counts: query.data?.byStatus ?? EMPTY_COUNTS,
    version: query.data?.version,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
