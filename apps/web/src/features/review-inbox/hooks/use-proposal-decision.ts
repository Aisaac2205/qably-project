'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposal, rejectProposal, type ApprovalResult, type RejectionResult } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'
import { ApiError } from '@/lib/api-client'

interface DecisionCallbacks {
  onApproved: (proposalId: string, result: ApprovalResult) => void
  onRejected: (proposalId: string, result: RejectionResult) => void
  onError?: (error: unknown, proposalId: string) => void
}

interface DecisionVariables {
  proposalId: string
  comment?: string
}

export type DecisionErrorCode =
  | 'invalid-transition'
  | 'missing-evidence'
  | 'missing-suite'
  | 'name-taken'
  | 'error'

function classifyDecisionError(error: unknown): DecisionErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invalid-transition':
      case 'missing-evidence':
      case 'missing-suite':
      case 'name-taken':
        return error.code
    }
  }
  return 'error'
}

export function useProposalDecision({
  onApproved,
  onRejected,
  onError,
}: DecisionCallbacks) {
  const queryClient = useQueryClient()
  const [decisionError, setDecisionError] = useState<DecisionErrorCode | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
  }

  const handleError = (error: unknown, proposalId: string) => {
    const code = classifyDecisionError(error)
    setDecisionError(code)
    if (code === 'invalid-transition') invalidate()
    onError?.(error, proposalId)
  }

  const approval = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      approveProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidate()
      onApproved(proposalId, result)
    },
    onError: (error, { proposalId }) => handleError(error, proposalId),
  })

  const rejection = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      rejectProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidate()
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
