import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { __resetStore, getSnapshot } from '@/lib/mock-store'

describe('useAiReview governed decisions', () => {
  beforeEach(() => __resetStore())

  it('approves the associated proposal and creates the governed review graph', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    const selectedId = result.current.selectedCase!.id
    const proposalId = getSnapshot().proposalIdByAiCaseId[selectedId]
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
    expect(snapshot.aiCases.find((item) => item.id === selectedId)?.reviewStatus).toBe('confirmed')
  })

  it('rejects the associated proposal with a review decision', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    const selectedId = result.current.selectedCase!.id
    const proposalId = getSnapshot().proposalIdByAiCaseId[selectedId]

    act(() => {
      result.current.rejectSelected()
    })

    const snapshot = getSnapshot()
    expect(snapshot.proposals.find((proposal) => proposal.id === proposalId)?.status).toBe('rejected')
    expect(snapshot.reviewDecisions.at(-1)).toMatchObject({ proposalId, actorId: 'member-1', action: 'rejected' })
    expect(snapshot.aiCases.find((item) => item.id === selectedId)?.reviewStatus).toBe('rejected')
  })

  it('does not expose a mass-confirm action', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))

    expect(result.current).not.toHaveProperty('confirmAll')
  })
})
