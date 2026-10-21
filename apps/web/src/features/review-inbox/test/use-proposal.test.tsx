import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { ReactNode } from 'react'
import { useProposal } from '@/features/review-inbox/hooks/use-proposals'
import { CASE_DOCUMENTING_REFETCH_MS } from '@/features/review-inbox/lib/case-documenting'
import * as reviewApi from '@/features/review-inbox/api/review.api'

function detail(outcomeAt: string | null): reviewApi.ProposalDetail {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: '',
    preconditions: [],
    steps: ['Open the cart'],
    expectedResult: '',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: '',
    needsManualReview: false,
    evidence: null,
    links: [],
    matchedCase: {
      id: 'case-1',
      name: 'Empties the cart',
      suiteId: 'suite-1',
      suiteName: 'Cart',
      documentation: { queuedAt: '2026-10-20T10:00:00.000Z', outcomeAt },
    },
    publishedVersion: null,
    source: null,
    recentRuns: [],
    decision: null,
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useProposal while Aeris documents the case', () => {
  let getProposal: MockInstance<typeof reviewApi.getProposal>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getProposal = vi.spyOn(reviewApi, 'getProposal')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('refetches the detail until the documentation run finishes, then stops', async () => {
    getProposal
      .mockResolvedValueOnce(detail(null))
      .mockResolvedValue(detail('2026-10-20T10:01:00.000Z'))

    const { result } = renderHook(() => useProposal('proposal-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.proposal).toBeDefined())
    expect(getProposal).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CASE_DOCUMENTING_REFETCH_MS)
    })
    await waitFor(() =>
      expect(result.current.proposal?.matchedCase?.documentation.outcomeAt).not.toBeNull(),
    )
    expect(getProposal).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CASE_DOCUMENTING_REFETCH_MS * 3)
    })
    expect(getProposal).toHaveBeenCalledTimes(2)
  })

  it('does not poll a proposal whose case is not being documented', async () => {
    getProposal.mockResolvedValue(detail('2026-10-20T10:01:00.000Z'))

    const { result } = renderHook(() => useProposal('proposal-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.proposal).toBeDefined())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CASE_DOCUMENTING_REFETCH_MS * 3)
    })
    expect(getProposal).toHaveBeenCalledTimes(1)
  })
})
