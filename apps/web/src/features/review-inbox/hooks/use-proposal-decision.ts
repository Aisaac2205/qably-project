'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import {
  approveProposal,
  rejectProposal,
  type ApprovalResult,
  type RejectionResult,
  type ReviewInboxPageResult,
  type ReviewInboxCountsResult,
} from '../api/review.api'
import {
  classifyDecisionError,
  extractDecisionConflict,
  type DecisionErrorCode,
  type DecisionConflict,
} from '../lib/decision-error'
import {
  invalidateReviewLists,
  invalidateSuiteAndProjectLists,
} from '../lib/invalidate-after-decision'
import { removeFromPages, reinsertAt, adjustCounts, type RemovedItemPosition } from '../lib/inbox-cache'
import { reviewKeys } from '../lib/query-keys'

export type { DecisionErrorCode } from '../lib/decision-error'
export { decisionErrorKey } from '../lib/decision-error'

const DECISION_MUTATION_KEY = ['review', 'decision'] as const
const INBOX_LIST_KEY = ['review', 'inbox'] as const
const INBOX_COUNTS_KEY = ['review', 'inbox-counts'] as const

interface DecisionCallbacks {
  onApproved: (proposalId: string, result: ApprovalResult) => void
  onRejected: (proposalId: string, result: RejectionResult) => void
  onError?: (code: DecisionErrorCode, proposalId: string, conflict: DecisionConflict | null) => void
}

interface DecisionVariables {
  proposalId: string
  comment?: string
}

interface MutationContext {
  removed: RemovedItemPosition | null
}

export function useProposalDecision({
  onApproved,
  onRejected,
  onError,
}: DecisionCallbacks) {
  const queryClient = useQueryClient()
  const [decisionError, setDecisionError] = useState<DecisionErrorCode | null>(null)
  const inFlightRef = useRef<Set<string>>(new Set())

  const applyOptimisticRemoval = async (proposalId: string): Promise<MutationContext> => {
    await queryClient.cancelQueries({ queryKey: reviewKeys.all })

    let removed: RemovedItemPosition | null = null

    queryClient.setQueriesData<InfiniteData<ReviewInboxPageResult>>(
      { queryKey: INBOX_LIST_KEY },
      (data) => {
        const result = removeFromPages(data, proposalId)
        if (result.removed !== null) removed = result.removed
        return result.data
      },
    )

    if (removed !== null) {
      queryClient.setQueriesData<ReviewInboxCountsResult>(
        { queryKey: INBOX_COUNTS_KEY },
        (counts) =>
          counts === undefined
            ? counts
            : { ...counts, byStatus: adjustCounts(counts.byStatus, 'in_review', -1) },
      )
    }

    return { removed }
  }

  const rollback = (context: MutationContext | undefined) => {
    const position = context?.removed
    if (position === null || position === undefined) return

    queryClient.setQueriesData<InfiniteData<ReviewInboxPageResult>>(
      { queryKey: INBOX_LIST_KEY },
      (data) => reinsertAt(data, position),
    )
    queryClient.setQueriesData<ReviewInboxCountsResult>(
      { queryKey: INBOX_COUNTS_KEY },
      (counts) =>
        counts === undefined
          ? counts
          : { ...counts, byStatus: adjustCounts(counts.byStatus, 'in_review', 1) },
    )
  }

  const settle = () => {
    if (queryClient.isMutating({ mutationKey: DECISION_MUTATION_KEY }) === 1) {
      invalidateReviewLists(queryClient)
    }
    invalidateSuiteAndProjectLists(queryClient)
  }

  const release = (proposalId: string) => {
    inFlightRef.current.delete(proposalId)
  }

  const handleError = (error: unknown, proposalId: string) => {
    const code = classifyDecisionError(error)
    const conflict = code === 'invalid-transition' ? extractDecisionConflict(error) : null
    setDecisionError(code)
    onError?.(code, proposalId, conflict)
  }

  const approval = useMutation({
    mutationKey: [...DECISION_MUTATION_KEY, 'approve'],
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      approveProposal(proposalId, comment),
    onMutate: ({ proposalId }) => applyOptimisticRemoval(proposalId),
    onSuccess: (result, { proposalId }) => {
      onApproved(proposalId, result)
    },
    onError: (error, { proposalId }, context) => {
      const code = classifyDecisionError(error)
      if (code !== 'invalid-transition') rollback(context)
      handleError(error, proposalId)
    },
    onSettled: (_result, _error, { proposalId }) => {
      release(proposalId)
      settle()
    },
  })

  const rejection = useMutation({
    mutationKey: [...DECISION_MUTATION_KEY, 'reject'],
    mutationFn: ({ proposalId, comment }: DecisionVariables) =>
      rejectProposal(proposalId, comment),
    onMutate: ({ proposalId }) => applyOptimisticRemoval(proposalId),
    onSuccess: (result, { proposalId }) => {
      onRejected(proposalId, result)
    },
    onError: (error, { proposalId }, context) => {
      const code = classifyDecisionError(error)
      if (code !== 'invalid-transition') rollback(context)
      handleError(error, proposalId)
    },
    onSettled: (_result, _error, { proposalId }) => {
      release(proposalId)
      settle()
    },
  })

  return {
    approve: (proposalId: string, comment?: string) => {
      if (inFlightRef.current.has(proposalId)) return
      inFlightRef.current.add(proposalId)
      setDecisionError(null)
      approval.mutate({ proposalId, comment })
    },
    reject: (proposalId: string, comment?: string) => {
      if (inFlightRef.current.has(proposalId)) return
      inFlightRef.current.add(proposalId)
      setDecisionError(null)
      rejection.mutate({ proposalId, comment })
    },
    isDeciding: (proposalId: string) => inFlightRef.current.has(proposalId),
    decisionError,
  }
}
