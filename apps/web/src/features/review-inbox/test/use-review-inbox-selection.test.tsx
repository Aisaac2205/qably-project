import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReviewInboxSelection } from '@/features/review-inbox/hooks/use-review-inbox-selection'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import type { ProposalDetail, ProposalListItem } from '@/features/review-inbox/api/review.api'

let searchParamsQuery = ''
let isMobileViewport = false

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return isMobileViewport
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
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

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function resetUrl() {
  window.history.replaceState(null, '', '/review-inbox')
}

describe('useReviewInboxSelection', () => {
  beforeEach(() => {
    searchParamsQuery = ''
    isMobileViewport = false
    resetUrl()
  })

  it('finds the deep-linked proposal even when it is outside the loaded page', async () => {
    searchParamsQuery = 'proposal=approved-1'
    const client = newClient()
    const approvedDetail: ProposalDetail = {
      ...proposal({ id: 'approved-1', status: 'approved', title: 'Valid checkout completes order' }),
      evidence: null,
      links: [],
    }
    client.setQueryData(reviewKeys.detail('approved-1'), approvedDetail)

    const inReviewProposals = [proposal({ id: 'pending-1' })]

    const { result } = renderHook(
      () => useReviewInboxSelection(inReviewProposals, inReviewProposals),
      { wrapper: wrapper(client) },
    )

    await waitFor(() => expect(result.current.activeSelectedId).toBe('approved-1'))
    expect(result.current.selectedProposal?.title).toBe('Valid checkout completes order')
  })

  it('falls back to the first filtered proposal when the deep-linked id resolves to nothing', async () => {
    searchParamsQuery = 'proposal=does-not-exist'
    const client = newClient()
    const inReviewProposals = [proposal({ id: 'pending-1' })]

    const { result } = renderHook(
      () => useReviewInboxSelection(inReviewProposals, inReviewProposals),
      { wrapper: wrapper(client) },
    )

    await waitFor(() => expect(result.current.activeSelectedId).toBe('pending-1'))
  })

  it('deep link opens detail on mobile when ?proposal= is present', async () => {
    isMobileViewport = true
    searchParamsQuery = 'proposal=pending-1'
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    await waitFor(() => expect(result.current.activeSelectedId).toBe('pending-1'))
    expect(result.current.isDetailOpenOnMobile).toBe(true)
  })

  it('skips auto-selecting the first proposal on mobile when nothing is deep-linked', () => {
    isMobileViewport = true
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    expect(result.current.activeSelectedId).toBeUndefined()
    expect(result.current.isDetailOpenOnMobile).toBe(false)
  })

  it('auto-selects the first proposal on desktop when nothing is deep-linked', () => {
    isMobileViewport = false
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    expect(result.current.activeSelectedId).toBe('pending-1')
  })

  it('pushes a history entry when opening detail from the list on mobile', () => {
    isMobileViewport = true
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]
    const pushSpy = vi.spyOn(window.history, 'pushState')

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    act(() => result.current.selectFromList('pending-1'))

    expect(pushSpy).toHaveBeenCalledWith(null, '', '/review-inbox?proposal=pending-1')
    pushSpy.mockRestore()
  })

  it('replaces, never pushes, when selecting from the list on desktop', () => {
    isMobileViewport = false
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    act(() => result.current.selectFromList('pending-2'))

    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/review-inbox?proposal=pending-2')
    pushSpy.mockRestore()
    replaceSpy.mockRestore()
  })

  it('mobile back restores the list after opening detail from a list tap', async () => {
    isMobileViewport = true
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1' }), proposal({ id: 'pending-2' })]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    act(() => result.current.selectFromList('pending-1'))
    await waitFor(() => expect(result.current.activeSelectedId).toBe('pending-1'))

    act(() => result.current.closeDetail())

    await waitFor(() => expect(result.current.activeSelectedId).toBeUndefined())
    expect(result.current.isDetailOpenOnMobile).toBe(false)
  })

  it('advances to the next pending proposal after a decision, using replaceState not pushState', () => {
    isMobileViewport = true
    searchParamsQuery = 'proposal=pending-1'
    const client = newClient()
    const proposals = [
      proposal({ id: 'pending-1' }),
      proposal({ id: 'pending-2' }),
      proposal({ id: 'pending-3' }),
    ]
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    act(() => result.current.selectNextPending())

    expect(result.current.activeSelectedId).toBe('pending-2')
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/review-inbox?proposal=pending-2')
    pushSpy.mockRestore()
    replaceSpy.mockRestore()
  })

  it('fetches the next page when advancing past the end of the loaded pending proposals', () => {
    searchParamsQuery = 'proposal=pending-1'
    const client = newClient()
    const proposals = [proposal({ id: 'pending-1', status: 'approved' })]
    const fetchNextPage = vi.fn()

    const { result } = renderHook(
      () =>
        useReviewInboxSelection(proposals, proposals, {
          hasNextPage: true,
          fetchNextPage,
        }),
      { wrapper: wrapper(client) },
    )

    act(() => result.current.selectNextPending())

    expect(fetchNextPage).toHaveBeenCalled()
  })

  it('advances to the newly loaded pending proposal once the next page arrives', async () => {
    searchParamsQuery = 'proposal=pending-1'
    const client = newClient()
    const fetchNextPage = vi.fn()
    let proposals = [proposal({ id: 'pending-1' })]

    const { result, rerender } = renderHook(
      ({ items }: { items: ProposalListItem[] }) =>
        useReviewInboxSelection(items, items, { hasNextPage: true, fetchNextPage }),
      { wrapper: wrapper(client), initialProps: { items: proposals } },
    )

    act(() => result.current.selectNextPending())
    expect(fetchNextPage).toHaveBeenCalledTimes(1)

    proposals = [...proposals, proposal({ id: 'pending-2' })]
    rerender({ items: proposals })

    await waitFor(() => expect(result.current.activeSelectedId).toBe('pending-2'))
  })

  it('reports the 1-based position and total among the filtered proposals', () => {
    searchParamsQuery = 'proposal=pending-2'
    const client = newClient()
    const proposals = [
      proposal({ id: 'pending-1' }),
      proposal({ id: 'pending-2' }),
      proposal({ id: 'pending-3' }),
    ]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    expect(result.current.position).toEqual({ index: 2, total: 3 })
  })

  it('moves to the previous and next proposal in filtered order', () => {
    searchParamsQuery = 'proposal=pending-2'
    const client = newClient()
    const proposals = [
      proposal({ id: 'pending-1' }),
      proposal({ id: 'pending-2' }),
      proposal({ id: 'pending-3' }),
    ]

    const { result } = renderHook(() => useReviewInboxSelection(proposals, proposals), {
      wrapper: wrapper(client),
    })

    act(() => result.current.goToNext())
    expect(result.current.activeSelectedId).toBe('pending-3')

    act(() => result.current.goToPrevious())
    act(() => result.current.goToPrevious())
    expect(result.current.activeSelectedId).toBe('pending-1')
  })
})
