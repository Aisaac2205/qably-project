'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposal, rejectProposal } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

interface DecisionCallbacks {
  onApproved: () => void
  onRejected: () => void
}

export function useProposalDecision({
  onApproved,
  onRejected,
}: DecisionCallbacks) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
  }

  const approval = useMutation({
    mutationFn: (proposalId: string) => approveProposal(proposalId),
    onSuccess: () => {
      invalidate()
      onApproved()
    },
  })

  const rejection = useMutation({
    mutationFn: (proposalId: string) => rejectProposal(proposalId),
    onSuccess: () => {
      invalidate()
      onRejected()
    },
  })

  return {
    approve: (proposalId: string) => approval.mutate(proposalId),
    reject: (proposalId: string) => rejection.mutate(proposalId),
    isDeciding: approval.isPending || rejection.isPending,
  }
}
