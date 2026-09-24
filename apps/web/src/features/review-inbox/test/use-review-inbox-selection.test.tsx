import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReviewInboxSelection } from '@/features/review-inbox/hooks/use-review-inbox-selection'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import type { ProposalDetail, ProposalListItem } from '@/features/review-inbox/api/review.api'

let searchParamsQuery = ''

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

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

describe('useReviewInboxSelection', () => {
  beforeEach(() => {
    searchParamsQuery = ''
  })

  it('finds the deep-linked proposal even when it is outside the loaded page', async () => {
    searchParamsQuery = 'proposal=approved-1'
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const inReviewProposals = [proposal({ id: 'pending-1' })]

    const { result } = renderHook(
      () => useReviewInboxSelection(inReviewProposals, inReviewProposals),
      { wrapper: wrapper(client) },
    )

    await waitFor(() => expect(result.current.activeSelectedId).toBe('pending-1'))
  })
})
