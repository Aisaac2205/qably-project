'use client'

import { useQuery } from '@tanstack/react-query'
import { getInboxCounts } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

/** How often the count is refreshed while the tab is visible. */
export const INBOX_PENDING_REFRESH_MS = 30_000

const INBOX_PENDING_STALE_MS = 15_000

/**
 * How many proposals wait in review across the whole organization, for the
 * badge on the sidebar. It reads the unfiltered counts the inbox page itself
 * uses, so the badge and the page share one cache entry and never disagree, and
 * the counts endpoint already answers it: no extra request type is needed.
 *
 * Zero until the first answer and whenever the counts cannot be read, which
 * keeps the badge hidden instead of showing a stale or made-up number.
 */
export function useInboxPendingCount(): number {
  const query = useQuery({
    queryKey: reviewKeys.inboxCounts({}),
    queryFn: ({ signal }) => getInboxCounts({}, signal),
    staleTime: INBOX_PENDING_STALE_MS,
    refetchInterval: INBOX_PENDING_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  return query.data?.byStatus.in_review ?? 0
}
