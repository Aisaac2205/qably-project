import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query'
import { useProposalDecision } from '@/features/review-inbox/hooks/use-proposal-decision'
import { ApiError } from '@/lib/api-client'
import * as reviewApi from '@/features/review-inbox/api/review.api'
import type { ProposalListItem, ReviewInboxPageResult, ReviewInboxCountsResult } from '@/features/review-inbox/api/review.api'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function proposal(id: string, overrides: Partial<ProposalListItem> = {}): ProposalListItem {
  return {
    id,
    projectId: 'p1',
    status: 'in_review',
    title: `Proposal ${id}`,
    objective: 'objective',
    preconditions: [],
    steps: ['step'],
    expectedResult: 'result',
    priority: 'medium',
    evidenceId: 'ev-1',
    evidenceTitle: 'evidence',
    needsManualReview: false,
    ...overrides,
  }
}

const inboxFilters = { status: 'in_review' as const }

function seedInboxPage(client: QueryClient, ...ids: string[]) {
  const data: InfiniteData<ReviewInboxPageResult> = {
    pages: [{ items: ids.map((id) => proposal(id)), nextCursor: null }],
    pageParams: [null],
  }
  client.setQueryData(reviewKeys.inbox(inboxFilters), data)
  return data
}

function seedCounts(client: QueryClient, inReview: number) {
  const counts: ReviewInboxCountsResult = {
    byStatus: { in_review: inReview, approved: 0, rejected: 0, changes_requested: 0 },
    openCollisions: 0,
    version: 'v1',
  }
  client.setQueryData(reviewKeys.inboxCounts({}), counts)
  return counts
}

function inboxData(client: QueryClient) {
  return client.getQueryData<InfiniteData<ReviewInboxPageResult>>(reviewKeys.inbox(inboxFilters))
}

function counts(client: QueryClient) {
  return client.getQueryData<ReviewInboxCountsResult>(reviewKeys.inboxCounts({}))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const approvalResult: reviewApi.ApprovalResult = {
  createdNewCase: true,
  testCaseId: 'case-1',
  testCaseName: 'Empties the cart',
  suiteId: 'suite-1',
  versionId: 'version-1',
  version: 1,
  decisionId: 'decision-1',
}

describe('useProposalDecision', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports invalid-transition as already-decided', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(409, 'Conflict', 'invalid-transition'),
    )
    const client = makeClient()
    const onApproved = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved, onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('invalid-transition'))
    expect(onApproved).not.toHaveBeenCalled()
  })

  it('passes the who/what/when conflict details to onError for invalid-transition', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(409, 'Conflict', 'invalid-transition', {
        decision: {
          action: 'approved',
          decidedAt: '2026-01-05T12:00:00.000Z',
          decidedBy: { id: 'user-2', name: 'Grace Hopper' },
        },
      }),
    )
    const client = makeClient()
    const onError = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith('invalid-transition', 'proposal-1', {
      action: 'approved',
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    })
  })

  it('passes null as the conflict when the server sent no decision details', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(409, 'Conflict', 'invalid-transition'),
    )
    const client = makeClient()
    const onError = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError).toHaveBeenCalledWith('invalid-transition', 'proposal-1', null)
  })

  it('reports missing-suite and rolls back the optimistic removal', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(422, 'Unprocessable', 'missing-suite'),
    )
    const client = makeClient()
    seedInboxPage(client, 'proposal-1')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('missing-suite'))
    expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['proposal-1'])
  })

  it('passes the approval result to onApproved', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockResolvedValue(approvalResult)
    const client = makeClient()
    const onApproved = vi.fn()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved, onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
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

  it('invalidates suite and project data after a successful reject', async () => {
    vi.spyOn(reviewApi, 'rejectProposal').mockResolvedValue({ decisionId: 'decision-1' })
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.reject('proposal-1')
    })

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: suiteKeys.all }),
      ),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: projectKeys.all }),
    )
  })

  it('reports incomplete-proposal instead of a generic error when approving a proposal with no steps', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(422, 'Unprocessable', 'incomplete-proposal'),
    )
    const client = makeClient()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
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
    const client = makeClient()
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
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

  it('removes the card from the inbox page and decrements the count before the server responds', async () => {
    const { promise } = deferred<reviewApi.ApprovalResult>()
    vi.spyOn(reviewApi, 'approveProposal').mockReturnValue(promise)
    const client = makeClient()
    seedInboxPage(client, 'a', 'b')
    seedCounts(client, 2)
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('a')
    })

    await waitFor(() => expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['b']))
    expect(counts(client)?.byStatus.in_review).toBe(1)
  })

  it('ignores a second approve call for the same proposal while the first is still in flight', async () => {
    const { promise } = deferred<reviewApi.ApprovalResult>()
    const spy = vi.spyOn(reviewApi, 'approveProposal').mockReturnValue(promise)
    const client = makeClient()
    seedInboxPage(client, 'a')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('a')
      result.current.approve('a')
    })

    await waitFor(() => expect(inboxData(client)?.pages[0].items).toEqual([]))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('allows deciding a different proposal while one is still in flight', async () => {
    const { promise } = deferred<reviewApi.ApprovalResult>()
    const spy = vi.spyOn(reviewApi, 'approveProposal').mockReturnValue(promise)
    const client = makeClient()
    seedInboxPage(client, 'a', 'b')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('a')
      result.current.approve('b')
    })

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })

  it('reinserts the item at its original index when a non-conflict error occurs', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(500, 'Server error', 'error'),
    )
    const client = makeClient()
    seedInboxPage(client, 'a', 'b', 'c')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('b')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('error'))
    expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps the card removed instead of reinserting it when the server reports invalid-transition', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
      new ApiError(409, 'Conflict', 'invalid-transition'),
    )
    const client = makeClient()
    seedInboxPage(client, 'a', 'b')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('a')
    })

    await waitFor(() => expect(result.current.decisionError).toBe('invalid-transition'))
    expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['b'])
  })

  it('does not invalidate the inbox lists until every concurrent decision has settled', async () => {
    const a = deferred<reviewApi.ApprovalResult>()
    const b = deferred<reviewApi.ApprovalResult>()
    vi.spyOn(reviewApi, 'approveProposal')
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
    const client = makeClient()
    seedInboxPage(client, 'a', 'b')
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('a')
      result.current.approve('b')
    })

    a.resolve(approvalResult)
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: suiteKeys.all }),
      ),
    )
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: reviewKeys.all }),
    )

    b.resolve(approvalResult)
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: reviewKeys.all }),
      ),
    )
  })
})
