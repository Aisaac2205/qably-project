'use client'

import { useCallback, useState } from 'react'
import { useProposals } from '@/features/review-inbox/hooks/use-proposals'
import {
  useProposalDecision,
  type DecisionErrorCode,
} from '@/features/review-inbox/hooks/use-proposal-decision'
import { useTranslation } from '@/lib/i18n'

function decisionErrorMessage(
  code: DecisionErrorCode,
  t: (key: string) => string,
): string {
  switch (code) {
    case 'invalid-transition':
      return t('aiReview.decisionAlreadyDecided')
    case 'missing-evidence':
      return t('aiReview.decisionMissingEvidence')
    case 'missing-suite':
      return t('aiReview.decisionMissingSuite')
    case 'name-taken':
      return t('aiReview.decisionNameTaken')
    default:
      return t('aiReview.decisionError')
  }
}

export function useAiReview(projectId: string) {
  const { t } = useTranslation()
  const { proposals: cases, isLoading, isError } = useProposals({
    projectId,
    status: 'in_review',
  })
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const selectedCase = cases.find((c) => c.id === selectedId) ?? cases[0]

  const selectCase = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const skipSelected = useCallback(() => {
    if (!selectedCase) return
    const idx = cases.findIndex((c) => c.id === selectedCase.id)
    const remaining = cases.filter((c) => c.id !== selectedCase.id)
    setSelectedId(remaining[Math.min(idx, remaining.length - 1)]?.id)
  }, [cases, selectedCase])

  const { approve, reject, isDeciding, decisionError } = useProposalDecision({
    onApproved: () => setSelectedId(undefined),
    onRejected: () => setSelectedId(undefined),
  })

  const confirmSelected = useCallback(() => {
    if (selectedCase) approve(selectedCase.id)
  }, [selectedCase, approve])

  const rejectSelected = useCallback(() => {
    if (selectedCase) reject(selectedCase.id)
  }, [selectedCase, reject])

  return {
    cases,
    selectedCase,
    isLoading,
    isError,
    isDeciding,
    decisionError: decisionError === null ? null : decisionErrorMessage(decisionError, t),
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  }
}
