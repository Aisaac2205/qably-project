'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposal, rejectProposal } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

interface DecisionCallbacks {
  onApproved: (proposalId: string) => void
  onRejected: (proposalId: string) => void
  onError?: (error: unknown, proposalId: string) => void
}

interface DecisionVariables {
  proposalId: string
  comment?: string
}

export function useProposalDecision({
  onApproved,
  onRejected,
  onError,
}: DecisionCallbacks) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
  }

  const approval = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      approveProposal(proposalId, comment),
    onSuccess: (_, { proposalId }) => {
      invalidate()
      onApproved(proposalId)
    },
    onError: (error, { proposalId }) => onError?.(error, proposalId),
  })

  const rejection = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      rejectProposal(proposalId, comment),
    onSuccess: (_, { proposalId }) => {
      invalidate()
      onRejected(proposalId)
    },
    onError: (error, { proposalId }) => onError?.(error, proposalId),
  })

  return {
    approve: (proposalId: string, comment?: string) =>
      approval.mutate({ proposalId, comment }),
    reject: (proposalId: string, comment?: string) =>
      rejection.mutate({ proposalId, comment }),
    isDeciding: approval.isPending || rejection.isPending,
  }
}
