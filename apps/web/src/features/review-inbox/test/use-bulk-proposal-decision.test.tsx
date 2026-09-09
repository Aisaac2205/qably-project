import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBulkProposalDecision } from '@/features/review-inbox/hooks/use-bulk-proposal-decision'
import * as reviewApi from '@/features/review-inbox/api/review.api'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useBulkProposalDecision', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('approves the given ids and reports the per-item results', async () => {
    const results = [
      { id: 'proposal-1', outcome: 'approved' as const },
      { id: 'proposal-2', outcome: 'skipped' as const, reason: 'incomplete-proposal' as const },
    ]
    vi.spyOn(reviewApi, 'approveProposals').mockResolvedValue(results)
    const onApproved = vi.fn()
    const { result } = renderHook(() => useBulkProposalDecision({ onApproved }), { wrapper })

    act(() => {
      result.current.approveMany(['proposal-1', 'proposal-2'])
    })

    await waitFor(() => expect(onApproved).toHaveBeenCalledWith(results))
    expect(reviewApi.approveProposals).toHaveBeenCalledWith(['proposal-1', 'proposal-2'])
  })

  it('rejects the given ids and reports the per-item results', async () => {
    const results = [{ id: 'proposal-1', outcome: 'rejected' as const }]
    vi.spyOn(reviewApi, 'rejectProposals').mockResolvedValue(results)
    const onRejected = vi.fn()
    const { result } = renderHook(() => useBulkProposalDecision({ onRejected }), { wrapper })

    act(() => {
      result.current.rejectMany(['proposal-1'])
    })

    await waitFor(() => expect(onRejected).toHaveBeenCalledWith(results))
  })

  it('invalidates the proposals list after a bulk decision', async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(reviewApi, 'approveProposals').mockResolvedValue([
      { id: 'proposal-1', outcome: 'approved' },
    ])
    const { result } = renderHook(() => useBulkProposalDecision(), { wrapper })

    act(() => {
      result.current.approveMany(['proposal-1'])
    })

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })
})
