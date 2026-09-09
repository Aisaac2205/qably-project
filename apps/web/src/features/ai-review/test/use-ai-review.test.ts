import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { useAiReview } from '@/features/projects/test-generation/hooks/use-ai-review'
import { withQueryClient } from '@/lib/query-test-utils'

vi.mock('@/features/review-inbox/api/review.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/review-inbox/api/review.api')
  >('@/features/review-inbox/api/review.api')

  return {
    ...actual,
    approveProposal: vi.fn().mockResolvedValue({
      createdNewCase: true,
      testCaseId: 'case-1',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    }),
    rejectProposal: vi.fn().mockResolvedValue({ decisionId: 'decision-1' }),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  return withQueryClient(children)
}

describe('useAiReview', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('exposes only in_review proposals scoped to the project', () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })

    expect(result.current.cases.length).toBeGreaterThan(0)
    for (const proposal of result.current.cases) {
      expect(proposal.projectId).toBe('proj-1')
      expect(proposal.status).toBe('in_review')
    }
  })

  it('selects the first pending case by default', () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })

    expect(result.current.selectedCase?.id).toBe(result.current.cases[0]?.id)
  })

  it('approves the selected case', async () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })
    const firstId = result.current.selectedCase!.id

    act(() => {
      result.current.confirmSelected()
    })

    await waitFor(() => expect(result.current.isDeciding).toBe(false))

    const { approveProposal } = await import('@/features/review-inbox/api/review.api')
    expect(approveProposal).toHaveBeenCalledWith(firstId, undefined)
  })

  it('rejects the selected case', async () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })
    const firstId = result.current.selectedCase!.id

    act(() => {
      result.current.rejectSelected()
    })

    await waitFor(() => expect(result.current.isDeciding).toBe(false))

    const { rejectProposal } = await import('@/features/review-inbox/api/review.api')
    expect(rejectProposal).toHaveBeenCalledWith(firstId, undefined)
  })

  it('advances selection on skip without deciding the proposal', async () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })
    const firstId = result.current.selectedCase!.id

    act(() => {
      result.current.skipSelected()
    })

    expect(result.current.selectedCase?.id).not.toBe(firstId)

    const { approveProposal, rejectProposal } = await import(
      '@/features/review-inbox/api/review.api'
    )
    expect(approveProposal).not.toHaveBeenCalled()
    expect(rejectProposal).not.toHaveBeenCalled()
  })

  it('does not expose a mass-confirm action', () => {
    const { result } = renderHook(() => useAiReview('proj-1'), { wrapper })

    expect(result.current).not.toHaveProperty('confirmAll')
  })
})
