import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useInboxPage } from '@/features/review-inbox/hooks/use-inbox-page'
import * as reviewApi from '@/features/review-inbox/api/review.api'
import type { ProposalListItem } from '@/features/review-inbox/api/review.api'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function proposal(overrides: Partial<ProposalListItem> = {}): ProposalListItem {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: [],
    steps: ['Open the cart'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: 'src/cart.spec.ts',
    needsManualReview: false,
    ...overrides,
  }
}

describe('useInboxPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts the first page with a null cursor', async () => {
    const spy = vi
      .spyOn(reviewApi, 'getInboxPage')
      .mockResolvedValue({ items: [proposal()], nextCursor: null })

    renderHook(() => useInboxPage({ status: 'in_review' }), { wrapper })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        { status: 'in_review' },
        null,
        expect.any(Number),
        expect.anything(),
      ),
    )
  })

  it('flattens every loaded page into a single proposals array', async () => {
    vi.spyOn(reviewApi, 'getInboxPage').mockResolvedValue({
      items: [proposal({ id: 'a' }), proposal({ id: 'b' })],
      nextCursor: null,
    })

    const { result } = renderHook(() => useInboxPage({ status: 'in_review' }), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.proposals.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.current.hasNextPage).toBe(false)
  })

  it('requests the next page using the cursor the previous page returned', async () => {
    vi.spyOn(reviewApi, 'getInboxPage')
      .mockResolvedValueOnce({ items: [proposal({ id: 'a' })], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [proposal({ id: 'b' })], nextCursor: null })

    const { result } = renderHook(() => useInboxPage({ status: 'in_review' }), { wrapper })

    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() =>
      expect(result.current.proposals.map((p) => p.id)).toEqual(['a', 'b']),
    )
    expect(reviewApi.getInboxPage).toHaveBeenLastCalledWith(
      { status: 'in_review' },
      'cursor-1',
      expect.any(Number),
      expect.anything(),
    )
    expect(result.current.hasNextPage).toBe(false)
  })
})
