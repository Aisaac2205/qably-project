'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SuiteProposalDecision } from '@qably/types'
import {
  approveSuiteProposal,
  listSuiteProposals,
  rejectSuiteProposal,
} from '../api/review.api'
import { suiteKeys } from '@/features/projects/lib/query-keys'

export const suiteProposalKeys = {
  all: ['review', 'suite-proposals'] as const,
  pending: () => [...suiteProposalKeys.all, 'in_review'] as const,
}

export function useSuiteProposals() {
  const query = useQuery({
    queryKey: suiteProposalKeys.pending(),
    queryFn: ({ signal }) => listSuiteProposals({ status: 'in_review' }, signal),
  })

  return {
    suiteProposals: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useSuiteProposalDecision(
  onDecided: (decision: SuiteProposalDecision, action: 'approve' | 'reject') => void,
) {
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: suiteProposalKeys.all })
    await queryClient.invalidateQueries({ queryKey: suiteKeys.all })
  }

  const approve = useMutation({
    mutationFn: (id: string) => approveSuiteProposal(id),
    onSuccess: async (decision) => {
      await invalidate()
      onDecided(decision, 'approve')
    },
  })

  const reject = useMutation({
    mutationFn: (id: string) => rejectSuiteProposal(id),
    onSuccess: async (decision) => {
      await invalidate()
      onDecided(decision, 'reject')
    },
  })

  return {
    approve: (id: string) => approve.mutate(id),
    reject: (id: string) => reject.mutate(id),
    isDeciding: approve.isPending || reject.isPending,
    isError: approve.isError || reject.isError,
  }
}
