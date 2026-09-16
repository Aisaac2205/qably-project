import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProposalDecision } from '@/features/review-inbox/hooks/use-proposal-decision'
import { ApiError } from '@/lib/api-client'
import * as reviewApi from '@/features/review-inbox/api/review.api'
import { suiteKeys } from '@/features/projects/lib/query-keys'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useProposalDecision', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports invalid-transition as already-decided and invalidates the proposals list', async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(409, 'Conflict', 'invalid-transition'),
    )
    const onApproved = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved, onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('invalid-transition'))
    expect(onApproved).not.toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('reports missing-suite without invalidating the proposals list', async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(422, 'Unprocessable', 'missing-suite'),
    )
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('missing-suite'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('passes the approval result to onApproved', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockResolvedValue({
      createdNewCase: true,
      testCaseId: 'case-1',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    })
    const onApproved = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved, onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(onApproved).toHaveBeenCalled())
    expect(onApproved).toHaveBeenCalledWith(
      'proposal-1',
      expect.objectContaining({ testCaseName: 'Empties the cart', suiteId: 'suite-1' }),
    )
  })

  it('invalidates suite and project data after a successful reject, not just the review list', async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(reviewApi, 'rejectProposal').mockResolvedValue({ decisionId: 'decision-1' })
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.reject('proposal-1')
    })

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: suiteKeys.all }),
      ),
    )
  })

  it('invalidates suite and project data after a successful approve too', async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(reviewApi, 'approveProposal').mockResolvedValue({
      createdNewCase: true,
      testCaseId: 'case-1',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    })
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: suiteKeys.all }),
      ),
    )
  })

  it('reports incomplete-proposal instead of a generic error when approving a proposal with no steps', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(422, 'Unprocessable', 'incomplete-proposal'),
    )
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('incomplete-proposal'))
  })

  it('clears the previous decisionError when a new decision is attempted', async () => {
    vi.spyOn(reviewApi, 'rejectProposal')
      .mockRejectedValueOnce(new ApiError(409, 'Conflict', 'invalid-transition'))
      .mockResolvedValueOnce({ decisionId: 'decision-1' })
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper },
    )

    act(() => {
      result.current.reject('proposal-1')
    })
    await waitFor(() => expect(result.current.decisionError).toBe('invalid-transition'))

    act(() => {
      result.current.reject('proposal-2')
    })
    expect(result.current.decisionError).toBeNull()
  })
})
