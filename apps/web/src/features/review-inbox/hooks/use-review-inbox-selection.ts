'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ProposalListItem } from '../api/review.api'

export interface UseReviewInboxSelectionResult {
  selectedId: string | undefined
  setSelectedId: (id: string) => void
  activeSelectedId: string | undefined
  selectedProposal: ProposalListItem | undefined
  selectNextPending: () => void
}

export function useReviewInboxSelection(
  proposals: ProposalListItem[],
  filteredProposals: ProposalListItem[],
): UseReviewInboxSelectionResult {
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => searchParams.get('proposal') ?? undefined,
  )

  const activeSelectedId =
    selectedId !== undefined && proposals.some((p) => p.id === selectedId)
      ? selectedId
      : filteredProposals[0]?.id
  const selectedProposal = proposals.find((p) => p.id === activeSelectedId)

  const selectNextPending = useCallback(() => {
    const remainingPending = filteredProposals.filter(
      (p) => p.id !== activeSelectedId && p.status === 'in_review',
    )
    if (remainingPending.length > 0) {
      setSelectedId(remainingPending[0].id)
    }
  }, [activeSelectedId, filteredProposals])

  return { selectedId, setSelectedId, activeSelectedId, selectedProposal, selectNextPending }
}
