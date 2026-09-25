import type {
  ProposalDetail,
  ProposalListItem,
  ReviewInboxCountsFilters,
  ReviewInboxFilters,
  ReviewInboxStatusCounts,
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

function matchesSearch(proposal: ProposalListItem, search: string | undefined): boolean {
  if (search === undefined || search.trim() === '') return true
  const q = search.toLowerCase()
  return proposal.title.toLowerCase().includes(q) || proposal.objective.toLowerCase().includes(q)
}

export function proposalInboxFixtures(filters: ReviewInboxFilters): ProposalListItem[] {
  return proposalListFixtures().filter((proposal) => {
    if (filters.projectId !== undefined && proposal.projectId !== filters.projectId) return false
    if (filters.status !== 'all' && proposal.status !== filters.status) return false
    if (filters.duplicatesOnly === true && proposal.classification?.kind !== 'possible_duplicate') {
      return false
    }
    return matchesSearch(proposal, filters.search)
  })
}

export function proposalInboxCountsFixtures(
  filters: ReviewInboxCountsFilters = {},
): ReviewInboxStatusCounts {
  const scoped = proposalListFixtures().filter((proposal) => {
    if (filters.projectId !== undefined && proposal.projectId !== filters.projectId) return false
    return matchesSearch(proposal, filters.search)
  })

  return {
    in_review: scoped.filter((p) => p.status === 'in_review').length,
    approved: scoped.filter((p) => p.status === 'approved').length,
    rejected: scoped.filter((p) => p.status === 'rejected').length,
    changes_requested: scoped.filter((p) => p.status === 'changes_requested').length,
  }
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
    matchedCase: null,
    publishedVersion: null,
    source: null,
    recentRuns: [],
    decision: null,
  }))
}
