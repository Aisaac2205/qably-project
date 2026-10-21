import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { ReactNode } from 'react'
import { useInboxPendingCount } from '@/features/review-inbox/hooks/use-inbox-pending-count'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import * as reviewApi from '@/features/review-inbox/api/review.api'

function counts(inReview: number) {
  return {
    byStatus: { in_review: inReview, approved: 4, rejected: 1, changes_requested: 0 },
    version: `v-${inReview}`,
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    client,
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    },
  }
}

describe('useInboxPendingCount', () => {
  let getCounts: MockInstance<typeof reviewApi.getInboxCounts>

  beforeEach(() => {
    getCounts = vi.spyOn(reviewApi, 'getInboxCounts').mockResolvedValue(counts(18))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is zero until the counts arrive, so no badge flashes in', () => {
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useInboxPendingCount(), { wrapper })

    expect(result.current).toBe(0)
  })

  it('reports the proposals waiting in review across every project', async () => {
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useInboxPendingCount(), { wrapper })

    await waitFor(() => expect(result.current).toBe(18))
    expect(getCounts).toHaveBeenCalledWith({}, expect.anything())
  })

  it('reads the same cache entry as the unfiltered inbox counts, so the two never disagree', async () => {
    const { client, wrapper } = makeWrapper()

    renderHook(() => useInboxPendingCount(), { wrapper })

    await waitFor(() => expect(client.getQueryData(reviewKeys.inboxCounts({}))).toEqual(counts(18)))
  })

  it('stays at zero when the counts cannot be read', async () => {
    getCounts.mockRejectedValue(new Error('offline'))
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useInboxPendingCount(), { wrapper })

    await waitFor(() => expect(getCounts).toHaveBeenCalled())
    expect(result.current).toBe(0)
  })

  describe('refresh', () => {
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    let tabState: 'visible' | 'hidden'

    function setTabState(next: 'visible' | 'hidden') {
      tabState = next
      window.dispatchEvent(new Event('visibilitychange'))
    }

    beforeEach(() => {
      tabState = 'visible'
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => tabState,
      })
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
      if (visibility) Object.defineProperty(Document.prototype, 'visibilityState', visibility)
      Reflect.deleteProperty(document, 'visibilityState')
    })

    it('asks again every 30 seconds while the tab is visible', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(() => useInboxPendingCount(), { wrapper })
      await waitFor(() => expect(result.current).toBe(18))

      getCounts.mockResolvedValue(counts(25))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      await waitFor(() => expect(result.current).toBe(25))
    })

    it('does not poll from a background tab, and catches up when the person returns', async () => {
      const { wrapper } = makeWrapper()
      const { result } = renderHook(() => useInboxPendingCount(), { wrapper })
      await waitFor(() => expect(result.current).toBe(18))
      getCounts.mockClear()

      setTabState('hidden')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000)
      })
      expect(getCounts).not.toHaveBeenCalled()

      getCounts.mockResolvedValue(counts(30))
      setTabState('visible')

      await waitFor(() => expect(result.current).toBe(30))
    })
  })
})
