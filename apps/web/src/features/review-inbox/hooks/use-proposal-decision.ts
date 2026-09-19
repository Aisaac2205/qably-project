'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveProposal, rejectProposal, type ApprovalResult, type RejectionResult } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'
import { ApiError } from '@/lib/api-client'

interface DecisionCallbacks {
  onApproved: (proposalId: string, result: ApprovalResult) => void
  onRejected: (proposalId: string, result: RejectionResult) => void
  onError?: (code: DecisionErrorCode, proposalId: string) => void
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
  | 'incomplete-proposal'
  | 'error'

function classifyDecisionError(error: unknown): DecisionErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invalid-transition':
      case 'missing-evidence':
      case 'missing-suite':
      case 'name-taken':
      case 'incomplete-proposal':
        return error.code
    }
  }
  return 'error'
}

const DECISION_ERROR_KEYS: Record<DecisionErrorCode, string> = {
  'invalid-transition': 'decisionAlreadyDecided',
  'missing-evidence': 'decisionMissingEvidence',
  'missing-suite': 'decisionMissingSuite',
  'name-taken': 'decisionNameTaken',
  'incomplete-proposal': 'decisionIncompleteProposal',
  error: 'decisionError',
}

export function decisionErrorKey(code: DecisionErrorCode): string {
  return DECISION_ERROR_KEYS[code]
}

export function useProposalDecision({
  onApproved,
  onRejected,
  onError,
}: DecisionCallbacks) {
  const queryClient = useQueryClient()
  const [decisionError, setDecisionError] = useState<DecisionErrorCode | null>(null)

  const invalidateReview = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
  }

  // A successful decision can create or update a test case (approve) or free
  // one up from "in review" (reject) — both change what the suite/project
  // pages show, so their caches need to be invalidated too. reviewKeys alone
  // left the suite page serving a stale pendingProposalId after a reject.
  const invalidateAfterDecision = () => {
    invalidateReview()
    void queryClient.invalidateQueries({ queryKey: suiteKeys.all })
    void queryClient.invalidateQueries({ queryKey: projectKeys.all })
  }

  const handleError = (error: unknown, proposalId: string) => {
    const code = classifyDecisionError(error)
    setDecisionError(code)
    if (code === 'invalid-transition') invalidateReview()
    onError?.(code, proposalId)
  }

  const approval = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      approveProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidateAfterDecision()
      onApproved(proposalId, result)
    },
    onError: (error, { proposalId }) => handleError(error, proposalId),
  })

  const rejection = useMutation({
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      rejectProposal(proposalId, comment),
    onSuccess: (result, { proposalId }) => {
      invalidateAfterDecision()
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
