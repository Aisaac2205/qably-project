'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import type { ProposalListItem } from '../api/review.api'
import { useProposal } from './use-proposals'

export interface ReviewInboxPosition {
  index: number
  total: number
}

export interface UseReviewInboxSelectionResult {
  selectedId: string | undefined
  activeSelectedId: string | undefined
  selectedProposal: ProposalListItem | undefined
  isMobile: boolean
  isDetailOpenOnMobile: boolean
  selectFromList: (id: string) => void
  closeDetail: () => void
  selectNextPending: () => void
  position: ReviewInboxPosition | null
  goToPrevious: () => void
  goToNext: () => void
}

function buildProposalUrl(id: string | undefined): string {
  const params = new URLSearchParams(window.location.search)
  if (id === undefined) params.delete('proposal')
  else params.set('proposal', id)
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ''}`
}

export interface UseReviewInboxSelectionOptions {
  hasNextPage?: boolean
  fetchNextPage?: () => unknown
}

export function useReviewInboxSelection(
  proposals: ProposalListItem[],
  filteredProposals: ProposalListItem[],
  options: UseReviewInboxSelectionOptions = {},
): UseReviewInboxSelectionResult {
  const { hasNextPage = false, fetchNextPage } = options
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => searchParams.get('proposal') ?? undefined,
  )

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search)
      setSelectedId(params.get('proposal') ?? undefined)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const isLoaded = selectedId !== undefined && proposals.some((p) => p.id === selectedId)
  const { proposal: fallbackProposal } = useProposal(
    selectedId !== undefined && !isLoaded ? selectedId : undefined,
  )

  const resolvedSelectedId =
    selectedId !== undefined && (isLoaded || fallbackProposal !== undefined)
      ? selectedId
      : undefined

  const activeSelectedId =
    resolvedSelectedId ?? (isMobile ? undefined : filteredProposals[0]?.id)

  const selectedProposal =
    proposals.find((p) => p.id === activeSelectedId) ??
    (fallbackProposal?.id === activeSelectedId ? fallbackProposal : undefined)

  const advanceTo = useCallback((id: string) => {
    window.history.replaceState(null, '', buildProposalUrl(id))
    setSelectedId(id)
  }, [])

  const selectFromList = useCallback(
    (id: string) => {
      const opening = isMobile && selectedId === undefined
      if (opening) window.history.pushState(null, '', buildProposalUrl(id))
      else window.history.replaceState(null, '', buildProposalUrl(id))
      setSelectedId(id)
    },
    [isMobile, selectedId],
  )

  const closeDetail = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.history.replaceState(null, '', buildProposalUrl(undefined))
    setSelectedId(undefined)
  }, [])

  const pendingAdvanceRef = useRef(false)

  const nextPendingAfter = useCallback(
    (afterId: string | undefined) =>
      filteredProposals.find((p) => p.id !== afterId && p.status === 'in_review'),
    [filteredProposals],
  )

  const selectNextPending = useCallback(() => {
    const next = nextPendingAfter(activeSelectedId)
    if (next !== undefined) {
      advanceTo(next.id)
      return
    }
    if (hasNextPage && fetchNextPage !== undefined) {
      pendingAdvanceRef.current = true
      void fetchNextPage()
    }
  }, [activeSelectedId, nextPendingAfter, hasNextPage, fetchNextPage, advanceTo])

  useEffect(() => {
    if (!pendingAdvanceRef.current) return
    const next = nextPendingAfter(activeSelectedId)
    if (next !== undefined) {
      pendingAdvanceRef.current = false
      queueMicrotask(() => advanceTo(next.id))
    } else if (hasNextPage && fetchNextPage !== undefined) {
      void fetchNextPage()
    } else {
      pendingAdvanceRef.current = false
    }
  }, [filteredProposals, activeSelectedId, hasNextPage, fetchNextPage, nextPendingAfter, advanceTo])

  const position = useMemo<ReviewInboxPosition | null>(() => {
    if (activeSelectedId === undefined) return null
    const index = filteredProposals.findIndex((p) => p.id === activeSelectedId)
    if (index === -1) return null
    return { index: index + 1, total: filteredProposals.length }
  }, [activeSelectedId, filteredProposals])

  const goToPrevious = useCallback(() => {
    const index = filteredProposals.findIndex((p) => p.id === activeSelectedId)
    if (index <= 0) return
    advanceTo(filteredProposals[index - 1].id)
  }, [filteredProposals, activeSelectedId, advanceTo])

  const goToNext = useCallback(() => {
    const index = filteredProposals.findIndex((p) => p.id === activeSelectedId)
    if (index === -1 || index >= filteredProposals.length - 1) return
    advanceTo(filteredProposals[index + 1].id)
  }, [filteredProposals, activeSelectedId, advanceTo])

  return {
    selectedId,
    activeSelectedId,
    selectedProposal,
    isMobile,
    isDetailOpenOnMobile: isMobile && activeSelectedId !== undefined,
    selectFromList,
    closeDetail,
    selectNextPending,
    position,
    goToPrevious,
    goToNext,
  }
}
