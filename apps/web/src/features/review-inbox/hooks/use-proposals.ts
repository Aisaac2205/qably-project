'use client'

import { useQuery } from '@tanstack/react-query'
import { getProposal } from '../api/review.api'
import { caseDocumentingRefetchInterval } from '../lib/case-documenting'
import { reviewKeys } from '../lib/query-keys'

export function useProposal(proposalId: string | undefined) {
  const query = useQuery({
    queryKey: reviewKeys.detail(proposalId ?? ''),
    queryFn: ({ signal }) => getProposal(proposalId as string, signal),
    enabled: proposalId !== undefined && proposalId !== '',
    // While Aeris documents the case, keep the note and the comparison current.
    refetchInterval: (query) => caseDocumentingRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  })

  return {
    proposal: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
