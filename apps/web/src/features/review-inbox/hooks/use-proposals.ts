'use client'

import { useQuery } from '@tanstack/react-query'
import { getProposal, listProposals } from '../api/review.api'
import { reviewKeys } from '../lib/query-keys'

export function useProposals() {
  const query = useQuery({
    queryKey: reviewKeys.list,
    queryFn: ({ signal }) => listProposals({}, signal),
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
