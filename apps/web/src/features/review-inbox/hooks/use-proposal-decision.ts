'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposal, rejectProposal, type ApprovalResult, type RejectionResult } from '../api/review.api'
import { classifyDecisionError, type DecisionErrorCode } from '../lib/decision-error'
import { invalidateReviewLists, invalidateAfterDecision } from '../lib/invalidate-after-decision'

export type { DecisionErrorCode } from '../lib/decision-error'
export { decisionErrorKey } from '../lib/decision-error'

interface DecisionCallbacks {
  onApproved: (proposalId: string, result: ApprovalResult) => void
  onRejected: (proposalId: string, result: RejectionResult) => void
  onError?: (code: DecisionErrorCode, proposalId: string) => void
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
  const [decisionError, setDecisionError] = useState<DecisionErrorCode | null>(null)

  const handleError = (error: unknown, proposalId: string) => {
    const code = classifyDecisionError(error)
    setDecisionError(code)
    if (code === 'invalid-transition') invalidateReviewLists(queryClient)
    onError?.(code, proposalId)
  }

  const approval = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      approveProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidateAfterDecision(queryClient)
      onApproved(proposalId, result)
    },
    onError: (error, { proposalId }) => handleError(error, proposalId),
  })

  const rejection = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      rejectProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidateAfterDecision(queryClient)
      onRejected(proposalId, result)
    },
    onError: (error, { proposalId }) => handleError(error, proposalId),
  })

  return {
    approve: (proposalId: string, comment?: string) => {
      setDecisionError(null)
      approval.mutate({ proposalId, comment })
    },
    reject: (proposalId: string, comment?: string) => {
      setDecisionError(null)
      rejection.mutate({ proposalId, comment })
    },
    isDeciding: approval.isPending || rejection.isPending,
    decisionError,
  }
}
