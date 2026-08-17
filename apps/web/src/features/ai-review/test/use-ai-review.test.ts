import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { __resetStore, getSnapshot } from '@/lib/mock-store'

describe('useAiReview governed decisions', () => {
  beforeEach(() => __resetStore())

  it('exposes the pending queue as ExtractedProposal records, not AiCase', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    expect(result.current.selectedCase).toMatchObject({
      status: 'in_review',
      title: expect.any(String),
      evidenceId: expect.any(String),
    })
    expect(result.current.selectedCase).not.toHaveProperty('reviewStatus')
    expect(result.current.selectedCase).not.toHaveProperty('sourceFile')
  })

  it('approves the selected proposal and creates the governed review graph', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    const proposalId = result.current.selectedCase!.id
    const casesBefore = getSnapshot().officialTestCases.length
    const versionsBefore = getSnapshot().testCaseVersions.length

    act(() => {
      result.current.confirmSelected()
    })

    const snapshot = getSnapshot()
    expect(snapshot.proposals.find((proposal) => proposal.id === proposalId)?.status).toBe('approved')
    expect(snapshot.reviewDecisions.at(-1)).toMatchObject({ proposalId, actorId: 'member-1', action: 'approved' })
    expect(snapshot.officialTestCases).toHaveLength(casesBefore)
    expect(snapshot.testCaseVersions).toHaveLength(versionsBefore + 1)
    const publishedVersion = snapshot.testCaseVersions.at(-1)!
    expect(snapshot.officialTestCases.find((item) => item.id === publishedVersion.testCaseId)?.currentVersionId).toBe(publishedVersion.id)
    expect(snapshot.traceabilityLinks.some((link) => link.from.id === proposalId && link.relation === 'produced')).toBe(true)
  })

  it('rejects the selected proposal with a review decision', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    const proposalId = result.current.selectedCase!.id

    act(() => {
      result.current.rejectSelected()
    })

    const snapshot = getSnapshot()
    expect(snapshot.proposals.find((proposal) => proposal.id === proposalId)?.status).toBe('rejected')
    expect(snapshot.reviewDecisions.at(-1)).toMatchObject({ proposalId, actorId: 'member-1', action: 'rejected' })
  })

  it('advances selection on skip without mutating the proposal', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    const firstId = result.current.selectedCase!.id

    act(() => {
      result.current.skipSelected()
    })

    expect(result.current.selectedCase?.id).not.toBe(firstId)
    expect(getSnapshot().proposals.find((p) => p.id === firstId)?.status).toBe('in_review')
  })

  it('does not expose a mass-confirm action', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    expect(result.current).not.toHaveProperty('confirmAll')
  })
})
