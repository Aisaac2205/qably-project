'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposals, rejectProposals, type BulkDecisionItemResult } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

interface BulkDecisionCallbacks {
  onApproved?: (results: BulkDecisionItemResult[]) => void
  onRejected?: (results: BulkDecisionItemResult[]) => void
}

export function useBulkProposalDecision({ onApproved, onRejected }: BulkDecisionCallbacks = {}) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
  }

  const approval = useMutation({
    mutationFn: (ids: string[]) => approveProposals(ids),
    onSuccess: (results) => {
      invalidate()
      onApproved?.(results)
    },
  })

  const rejection = useMutation({
    mutationFn: (ids: string[]) => rejectProposals(ids),
    onSuccess: (results) => {
      invalidate()
      onRejected?.(results)
    },
  })

  return {
    approveMany: (ids: string[]) => approval.mutate(ids),
    rejectMany: (ids: string[]) => rejection.mutate(ids),
    isApproving: approval.isPending,
    isRejecting: rejection.isPending,
  }
}
