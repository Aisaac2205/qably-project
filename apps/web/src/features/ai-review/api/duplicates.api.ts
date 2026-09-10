import type { DuplicateCandidateView } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function getDuplicateCandidates(
  proposalId: string,
  signal?: AbortSignal,
): Promise<DuplicateCandidateView[]> {
  return apiRequest<DuplicateCandidateView[]>(
    `/review/proposals/${proposalId}/duplicates`,
    { signal },
  )
}
