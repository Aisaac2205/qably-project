import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  inboxCountsRefetchInterval,
  useInboxCounts,
} from '@/features/review-inbox/hooks/use-inbox-counts'
import * as reviewApi from '@/features/review-inbox/api/review.api'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('inboxCountsRefetchInterval', () => {
  it('pauses polling once the query is in an error state', () => {
    expect(inboxCountsRefetchInterval({ state: { status: 'error' } })).toBe(false)
  })

  it('polls every 15 seconds otherwise', () => {
    expect(inboxCountsRefetchInterval({ state: { status: 'success' } })).toBe(15000)
    expect(inboxCountsRefetchInterval({ state: { status: 'pending' } })).toBe(15000)
  })
})

describe('useInboxCounts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes byStatus counts from the counts endpoint', async () => {
    vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue({
      byStatus: { in_review: 3, approved: 1, rejected: 0, changes_requested: 0 },
      version: 'v1',
    })

    const { result } = renderHook(() => useInboxCounts({}), { wrapper })

    await waitFor(() => expect(result.current.counts.in_review).toBe(3))
    expect(result.current.counts.approved).toBe(1)
  })

  it('forwards projectId and search to the counts request', async () => {
    const spy = vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue({
      byStatus: { in_review: 0, approved: 0, rejected: 0, changes_requested: 0 },
      version: 'v1',
    })

    renderHook(() => useInboxCounts({ projectId: 'proj-1', search: 'cart' }), { wrapper })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ projectId: 'proj-1', search: 'cart' }, expect.anything()),
    )
  })

  it('defaults every status to zero while the request is pending', () => {
    vi.spyOn(reviewApi, 'getInboxCounts').mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useInboxCounts({}), { wrapper })

    expect(result.current.counts).toEqual({
      in_review: 0,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    })
  })
})
