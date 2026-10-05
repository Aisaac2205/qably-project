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
import { runKeys } from '@/features/runs/lib/query-keys'
import { useProposal } from '@/features/review-inbox/hooks/use-proposals'
import { approvalConflictError, conflictingCaseFixture } from './approval-conflict-fixture'

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
    expect(onError).toHaveBeenCalledWith(
      'invalid-transition',
      'proposal-1',
      {
        action: 'approved',
        decidedAt: '2026-01-05T12:00:00.000Z',
        decidedBy: { id: 'user-2', name: 'Grace Hopper' },
      },
      null,
    )
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
    expect(onError).toHaveBeenCalledWith('invalid-transition', 'proposal-1', null, null)
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

  it('marks cached run details stale after an approval so a run reads the approved documentation on the next visit', async () => {
    vi.spyOn(reviewApi, 'approveProposal').mockResolvedValue(approvalResult)
    const client = makeClient()
    client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
    client.setQueryData(runKeys.list('p1'), { items: [] })
    const { result } = renderHook(
      () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
      { wrapper: wrapperFor(client) },
    )

    act(() => {
      result.current.approve('proposal-1')
    })

    await waitFor(() =>
      expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(true),
    )
    expect(client.getQueryState(runKeys.list('p1'))?.isInvalidated).toBe(false)
  })

  it('leaves cached run details alone after a rejection, since nothing in the library changed', async () => {
    vi.spyOn(reviewApi, 'rejectProposal').mockResolvedValue({ decisionId: 'decision-1' })
    const client = makeClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
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
    expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(false)
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

  it('reports a late failure of an earlier decision to the callbacks of the latest render', async () => {
    const a = deferred<reviewApi.ApprovalResult>()
    const b = deferred<reviewApi.ApprovalResult>()
    vi.spyOn(reviewApi, 'approveProposal')
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
    const client = makeClient()
    seedInboxPage(client, 'a', 'b', 'c')
    const firstOnError = vi.fn()
    const latestOnError = vi.fn()
    const { result, rerender } = renderHook(
      ({ onError }: { onError: typeof firstOnError }) =>
        useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
      { wrapper: wrapperFor(client), initialProps: { onError: firstOnError } },
    )

    act(() => {
      result.current.approve('a')
    })
    act(() => {
      result.current.approve('b')
    })
    rerender({ onError: latestOnError })

    const conflict = await approvalConflictError('name-taken', conflictingCaseFixture)
    await act(async () => {
      a.reject(conflict)
    })

    await waitFor(() => expect(latestOnError).toHaveBeenCalled())
    expect(latestOnError).toHaveBeenCalledWith('name-taken', 'a', null, conflictingCaseFixture)
    expect(firstOnError).not.toHaveBeenCalled()
  })

  describe('approval conflicts', () => {
    it.each([
      ['name-taken', conflictingCaseFixture],
      ['automation-key-taken', conflictingCaseFixture],
      ['publish-conflict', null],
    ] as const)(
      'reports %s, puts the card back in the inbox and forwards the conflicting case',
      async (code, conflictingCase) => {
        vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
          await approvalConflictError(code, conflictingCase),
        )
        const client = makeClient()
        seedInboxPage(client, 'a', 'b', 'c')
        seedCounts(client, 3)
        const onError = vi.fn()
        const { result } = renderHook(
          () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
          { wrapper: wrapperFor(client) },
        )

        act(() => {
          result.current.approve('b')
        })

        await waitFor(() => expect(result.current.decisionError).toBe(code))
        expect(onError).toHaveBeenCalledWith(code, 'b', null, conflictingCase)
        expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
        expect(counts(client)?.byStatus.in_review).toBe(3)
      },
    )

    it('forwards a null conflicting case when the API could not name one', async () => {
      vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
        await approvalConflictError('name-taken', null),
      )
      const client = makeClient()
      const onError = vi.fn()
      const { result } = renderHook(
        () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
        { wrapper: wrapperFor(client) },
      )

      act(() => {
        result.current.approve('a')
      })

      await waitFor(() => expect(onError).toHaveBeenCalled())
      expect(onError).toHaveBeenCalledWith('name-taken', 'a', null, null)
    })

    it('forwards a null conflicting case when an older API sent no such field', async () => {
      vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
        new ApiError(409, 'Conflict', 'name-taken'),
      )
      const client = makeClient()
      const onError = vi.fn()
      const { result } = renderHook(
        () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
        { wrapper: wrapperFor(client) },
      )

      act(() => {
        result.current.approve('a')
      })

      await waitFor(() => expect(onError).toHaveBeenCalled())
      expect(onError).toHaveBeenCalledWith('name-taken', 'a', null, null)
    })

    it('does not forward a conflicting case for a failure that is not an approval conflict', async () => {
      vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
        new ApiError(422, 'Unprocessable', 'missing-suite', {
          conflictingCase: conflictingCaseFixture,
        }),
      )
      const client = makeClient()
      const onError = vi.fn()
      const { result } = renderHook(
        () => useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn(), onError }),
        { wrapper: wrapperFor(client) },
      )

      act(() => {
        result.current.approve('a')
      })

      await waitFor(() => expect(onError).toHaveBeenCalled())
      expect(onError).toHaveBeenCalledWith('missing-suite', 'a', null, null)
    })

    it('lets the reviewer approve the same proposal again once the conflict is reported', async () => {
      const approveSpy = vi
        .spyOn(reviewApi, 'approveProposal')
        .mockRejectedValueOnce(await approvalConflictError('publish-conflict', null))
        .mockResolvedValueOnce(approvalResult)
      const client = makeClient()
      seedInboxPage(client, 'a')
      const onApproved = vi.fn()
      const { result } = renderHook(
        () => useProposalDecision({ onApproved, onRejected: vi.fn() }),
        { wrapper: wrapperFor(client) },
      )

      act(() => {
        result.current.approve('a')
      })
      await waitFor(() => expect(result.current.decisionError).toBe('publish-conflict'))
      await waitFor(() => expect(result.current.isDeciding('a')).toBe(false))

      act(() => {
        result.current.approve('a')
      })

      await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1))
      expect(approveSpy).toHaveBeenCalledTimes(2)
      expect(result.current.decisionError).toBeNull()
    })

    it('lets the reviewer reject the proposal after an approval conflict', async () => {
      vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
        await approvalConflictError('name-taken', conflictingCaseFixture),
      )
      const rejectSpy = vi
        .spyOn(reviewApi, 'rejectProposal')
        .mockResolvedValue({ decisionId: 'decision-1' })
      const client = makeClient()
      seedInboxPage(client, 'a')
      const onRejected = vi.fn()
      const { result } = renderHook(
        () => useProposalDecision({ onApproved: vi.fn(), onRejected }),
        { wrapper: wrapperFor(client) },
      )

      act(() => {
        result.current.approve('a')
      })
      await waitFor(() => expect(result.current.decisionError).toBe('name-taken'))
      await waitFor(() => expect(result.current.isDeciding('a')).toBe(false))

      act(() => {
        result.current.reject('a')
      })

      await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
      expect(rejectSpy).toHaveBeenCalledTimes(1)
    })

    it('refetches the proposal and the inbox lists exactly once after automation-key-taken', async () => {
      vi.spyOn(reviewApi, 'approveProposal').mockRejectedValue(
        await approvalConflictError('automation-key-taken', conflictingCaseFixture),
      )
      const detail: reviewApi.ProposalDetail = {
        ...proposal('a'),
        evidence: null,
        links: [],
        matchedCase: null,
        publishedVersion: null,
        source: null,
        recentRuns: [],
        decision: null,
      }
      const detailSpy = vi.spyOn(reviewApi, 'getProposal').mockResolvedValue(detail)
      const client = makeClient()
      seedInboxPage(client, 'a')
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
      const { result } = renderHook(
        () => ({
          decision: useProposalDecision({ onApproved: vi.fn(), onRejected: vi.fn() }),
          detail: useProposal('a'),
        }),
        { wrapper: wrapperFor(client) },
      )
      await waitFor(() => expect(result.current.detail.proposal).toBeDefined())
      expect(detailSpy).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.decision.approve('a')
      })

      await waitFor(() => expect(result.current.decision.decisionError).toBe('automation-key-taken'))
      await waitFor(() => expect(detailSpy).toHaveBeenCalledTimes(2))
      const reviewInvalidations = invalidateSpy.mock.calls.filter(
        ([filters]) => filters?.queryKey === reviewKeys.all,
      )
      expect(reviewInvalidations).toHaveLength(1)
      expect(inboxData(client)?.pages[0].items.map((i) => i.id)).toEqual(['a'])
      expect(detailSpy).toHaveBeenCalledTimes(2)
    })
  })
})
