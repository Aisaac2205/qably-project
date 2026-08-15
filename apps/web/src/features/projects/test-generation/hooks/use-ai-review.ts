'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAiCases } from '@/lib/use-mock-store'
import { approveProposal, getMembers, getProposalForAiReviewCase, rejectProposal, skipAiCase } from '@/lib/mock-store'

export function useAiReview(projectId: string) {
  const allCases = useAiCases(projectId)
  const pending = useMemo(
    () => allCases.filter((c) => c.reviewStatus === 'pending'),
    [allCases],
  )

  const [selectedId, setSelectedId] = useState<string>(pending[0]?.id ?? '')

  const selectedCase = useMemo(
    () => pending.find((c) => c.id === selectedId) ?? pending[0] ?? null,
    [pending, selectedId],
  )

  const selectCase = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const confirmSelected = useCallback(() => {
    if (!selectedCase) return
    const proposal = getProposalForAiReviewCase(selectedCase.id)
    const actor = getMembers()[0]
    if (!proposal || !actor) return
    const result = approveProposal(proposal.id, { actorId: actor.id })
    if (!result.ok) return
    // Select next pending case
    const idx = pending.findIndex((c) => c.id === selectedCase.id)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedCase.id)
      // Next one after removal
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedCase, pending])

  const rejectSelected = useCallback(() => {
    if (!selectedCase) return
    const proposal = getProposalForAiReviewCase(selectedCase.id)
    const actor = getMembers()[0]
    if (!proposal || !actor) return
    const result = rejectProposal(proposal.id, { actorId: actor.id })
    if (!result.ok) return
    const idx = pending.findIndex((c) => c.id === selectedCase.id)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedCase.id)
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedCase, pending])

  const skipSelected = useCallback(() => {
    if (!selectedCase) return
    skipAiCase(selectedCase.id)
    const idx = pending.findIndex((c) => c.id === selectedCase.id)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedCase.id)
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedCase, pending])

  return {
    cases: pending,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  }
}
