'use client'

import { useQuery } from '@tanstack/react-query'
import { getProposal, listProposals, type ProposalFilters } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

export function useProposals(filters: ProposalFilters = {}) {
  const query = useQuery({
    queryKey: reviewKeys.list({ projectId: filters.projectId, status: filters.status }),
    queryFn: ({ signal }) => listProposals(filters, signal),
  })

  return {
    proposals: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useProposal(proposalId: string | undefined) {
  const query = useQuery({
    queryKey: reviewKeys.detail(proposalId ?? ''),
    queryFn: ({ signal }) => getProposal(proposalId as string, signal),
    enabled: proposalId !== undefined && proposalId !== '',
  })

  return {
    proposal: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
