import { isDocumenting } from '@/features/projects/suites/lib/documentation-state'
import type { ProposalDetail } from '../api/review.api'

/** How often the proposal detail is refetched while its case is being documented. */
export const CASE_DOCUMENTING_REFETCH_MS = 3_000

/**
 * Whether Aeris is documenting the case this proposal would update: a run is
 * queued with no later outcome. Only a proposal still in review cares, since
 * the reviewer is about to decide on it.
 */
export function isCaseBeingDocumented(detail: ProposalDetail | undefined): boolean {
  if (detail === undefined || detail.status !== 'in_review') return false
  return isDocumenting(detail.matchedCase?.documentation)
}

/**
 * Polls the detail only while the inspector says the case is being documented,
 * so the note clears, and the comparison updates, once the run finishes.
 */
export function caseDocumentingRefetchInterval(detail: ProposalDetail | undefined): number | false {
  return isCaseBeingDocumented(detail) ? CASE_DOCUMENTING_REFETCH_MS : false
}
