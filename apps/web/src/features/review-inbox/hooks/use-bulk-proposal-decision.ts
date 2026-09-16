'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposals, rejectProposals, type BulkDecisionItemResult } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'

interface BulkDecisionCallbacks {
  onApproved?: (results: BulkDecisionItemResult[]) => void
  onRejected?: (results: BulkDecisionItemResult[]) => void
}

export function useBulkProposalDecision({ onApproved, onRejected }: BulkDecisionCallbacks = {}) {
  const queryClient = useQueryClient()

  // See use-proposal-decision.ts: a decision can change what the suite/project
  // pages show, so reviewKeys alone leaves them stale (e.g. a bulk reject not
  // clearing "in review" on the suite page).
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    void queryClient.invalidateQueries({ queryKey: suiteKeys.all })
    void queryClient.invalidateQueries({ queryKey: projectKeys.all })
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
