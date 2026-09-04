import type {
  ProposalDetail,
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
