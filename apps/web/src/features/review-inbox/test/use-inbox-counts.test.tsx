import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  inboxCountsRefetchInterval,
  useInboxCounts,
} from '@/features/review-inbox/hooks/use-inbox-counts'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import * as reviewApi from '@/features/review-inbox/api/review.api'

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const wrapper = wrapperFor(makeClient())

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
      openCollisions: 0,
      version: 'v1',
    })

    const { result } = renderHook(() => useInboxCounts({}), { wrapper })

    await waitFor(() => expect(result.current.counts.in_review).toBe(3))
    expect(result.current.counts.approved).toBe(1)
  })

  it('exposes openCollisions from the counts endpoint', async () => {
    vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue({
      byStatus: { in_review: 0, approved: 0, rejected: 0, changes_requested: 0 },
      openCollisions: 5,
      version: 'v1',
    })

    const { result } = renderHook(() => useInboxCounts({}), { wrapper })

    await waitFor(() => expect(result.current.openCollisions).toBe(5))
  })

  it('forwards projectId and search to the counts request', async () => {
    const spy = vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue({
      byStatus: { in_review: 0, approved: 0, rejected: 0, changes_requested: 0 },
      openCollisions: 0,
      version: 'v1',
    })

    renderHook(() => useInboxCounts({ projectId: 'proj-1', search: 'cart' }), { wrapper })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ projectId: 'proj-1', search: 'cart' }, expect.anything()),
    )
  })

  it('defaults every status and openCollisions to zero while the request is pending', () => {
    vi.spyOn(reviewApi, 'getInboxCounts').mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useInboxCounts({}), { wrapper })

    expect(result.current.counts).toEqual({
      in_review: 0,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    })
    expect(result.current.openCollisions).toBe(0)
  })

  it('does not invalidate the inbox lists on the first load', async () => {
    vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue({
      byStatus: { in_review: 3, approved: 0, rejected: 0, changes_requested: 0 },
      openCollisions: 0,
      version: 'v1',
    })
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useInboxCounts({}), { wrapper: wrapperFor(client) })

    await waitFor(() => expect(result.current.version).toBe('v1'))
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['review', 'inbox'] }),
    )
  })

  it('invalidates the inbox lists when the counts version changes on a later poll', async () => {
    const spy = vi
      .spyOn(reviewApi, 'getInboxCounts')
      .mockResolvedValueOnce({
        byStatus: { in_review: 3, approved: 0, rejected: 0, changes_requested: 0 },
        openCollisions: 0,
        version: 'v1',
      })
      .mockResolvedValueOnce({
        byStatus: { in_review: 2, approved: 1, rejected: 0, changes_requested: 0 },
        openCollisions: 0,
        version: 'v2',
      })
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useInboxCounts({}), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.version).toBe('v1'))

    await client.refetchQueries({ queryKey: reviewKeys.inboxCounts({}) })
    await waitFor(() => expect(result.current.version).toBe('v2'))

    expect(spy).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['review', 'inbox'] }),
    )
  })
})
