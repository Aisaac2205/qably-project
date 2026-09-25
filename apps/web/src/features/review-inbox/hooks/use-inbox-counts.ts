'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInboxCounts,
  type ReviewInboxCountsFilters,
  type ReviewInboxStatusCounts,
} from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

const INBOX_LIST_KEY = ['review', 'inbox'] as const

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
  const queryClient = useQueryClient()
  const seenVersion = useRef<string | undefined>(undefined)

  const query = useQuery({
    queryKey: reviewKeys.inboxCounts(filters),
    queryFn: ({ signal }) => getInboxCounts(filters, signal),
    refetchInterval: inboxCountsRefetchInterval,
  })

  const version = query.data?.version

  useEffect(() => {
    if (version === undefined) return
    if (seenVersion.current !== undefined && seenVersion.current !== version) {
      void queryClient.invalidateQueries({ queryKey: INBOX_LIST_KEY })
    }
    seenVersion.current = version
  }, [version, queryClient])

  return {
    counts: query.data?.byStatus ?? EMPTY_COUNTS,
    version: query.data?.version,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
