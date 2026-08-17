'use client'

import { useState, useCallback, useMemo } from 'react'
import { useProposals } from '@/lib/use-mock-store'
import { approveProposal, getMembers, rejectProposal } from '@/lib/mock-store'

export function useAiReview(projectId: string) {
  const allProposals = useProposals(projectId)
  const pending = useMemo(
    () => allProposals.filter((p) => p.status === 'in_review'),
    [allProposals],
  )

  const [selectedId, setSelectedId] = useState<string>(pending[0]?.id ?? '')

  const selectedCase = useMemo(
    () => pending.find((p) => p.id === selectedId) ?? pending[0] ?? null,
    [pending, selectedId],
  )

  const selectCase = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const advanceSelection = useCallback((resolvedId: string) => {
    const idx = pending.findIndex((p) => p.id === resolvedId)
    if (idx < 0) return
    const remaining = pending.filter((p) => p.id !== resolvedId)
    setSelectedId(remaining[Math.min(idx, remaining.length - 1)]?.id ?? '')
  }, [pending])

  const confirmSelected = useCallback(() => {
    if (!selectedCase) return
    const actor = getMembers()[0]
    if (!actor) return
    const result = approveProposal(selectedCase.id, { actorId: actor.id })
    if (!result.ok) return
    advanceSelection(selectedCase.id)
  }, [selectedCase, advanceSelection])

  const rejectSelected = useCallback(() => {
    if (!selectedCase) return
    const actor = getMembers()[0]
    if (!actor) return
    const result = rejectProposal(selectedCase.id, { actorId: actor.id })
    if (!result.ok) return
    advanceSelection(selectedCase.id)
  }, [selectedCase, advanceSelection])

  const skipSelected = useCallback(() => {
    if (!selectedCase) return
    advanceSelection(selectedCase.id)
  }, [selectedCase, advanceSelection])

  return {
    cases: pending,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  }
}
