import type { ProposalStatus } from '@qably/types'
import type {
  ProposalDetail,
  ProposalFilters,
  ProposalListItem,
} from '@/features/review-inbox/api/review.api'
import { getSnapshot } from '@/lib/mock-store'

export function proposalListFixtures(): ProposalListItem[] {
  const snapshot = getSnapshot()

  return snapshot.proposals.map((proposal) => ({
    ...structuredClone(proposal),
    evidenceTitle:
      snapshot.evidence.find((item) => item.id === proposal.evidenceId)
        ?.title ?? '',
  }))
}

export function proposalListFixturesFor(
  filters: ProposalFilters = {},
): ProposalListItem[] {
  return proposalListFixtures().filter((proposal) => {
    if (filters.projectId !== undefined && proposal.projectId !== filters.projectId) {
      return false
    }
    if (filters.status !== undefined && proposal.status !== filters.status) {
      return false
    }
    return true
  })
}

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'in_review',
  'approved',
  'rejected',
  'changes_requested',
]

export function proposalDetailFixtures(): ProposalDetail[] {
  const snapshot = getSnapshot()

  return proposalListFixtures().map((proposal) => ({
    ...proposal,
    evidence:
      structuredClone(
        snapshot.evidence.find((item) => item.id === proposal.evidenceId),
      ) ?? null,
    links: structuredClone(
      snapshot.traceabilityLinks.filter(
        (link) => link.from.id === proposal.id || link.to.id === proposal.id,
      ),
    ),
  }))
}
