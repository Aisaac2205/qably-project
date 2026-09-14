'use client'

import { useQuery } from '@tanstack/react-query'
import { getDuplicateCandidates } from '../api/duplicates.api'
import { duplicateKeys } from '../lib/query-keys'

export function useDuplicateCandidates(proposalId: string) {
  const query = useQuery({
    queryKey: duplicateKeys.detail(proposalId),
    queryFn: ({ signal }) => getDuplicateCandidates(proposalId, signal),
  })

  return {
    candidates: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
