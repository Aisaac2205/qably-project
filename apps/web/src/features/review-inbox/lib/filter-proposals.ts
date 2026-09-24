import type { ProposalListItem } from '../api/review.api'

export type ReviewQueueStatusFilter = 'in_review' | 'all' | 'approved' | 'rejected'

export interface ScopeProposalsOptions {
  selectedProjectId: string
  duplicateOnly: boolean
  searchQuery: string
  projectNameById: Map<string, string>
}

export function scopeProposals(
  proposals: ProposalListItem[],
  { selectedProjectId, duplicateOnly, searchQuery, projectNameById }: ScopeProposalsOptions,
): ProposalListItem[] {
  return proposals.filter((p) => {
    if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) {
      return false
    }
    if (duplicateOnly && p.possibleDuplicate !== true) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = p.title.toLowerCase().includes(q)
      const objMatch = p.objective.toLowerCase().includes(q)
      const projectNameMatch = (projectNameById.get(p.projectId) ?? '').toLowerCase().includes(q)
      return titleMatch || objMatch || projectNameMatch
    }
    return true
  })
}

export function countByStatus(scoped: ProposalListItem[]): Record<ReviewQueueStatusFilter, number> {
  return {
    all: scoped.length,
    in_review: scoped.filter((p) => p.status === 'in_review').length,
    approved: scoped.filter((p) => p.status === 'approved').length,
    rejected: scoped.filter((p) => p.status === 'rejected').length,
  }
}

export function filterByStatus(
  scoped: ProposalListItem[],
  statusFilter: ReviewQueueStatusFilter,
): ProposalListItem[] {
  return scoped.filter((p) => statusFilter === 'all' || p.status === statusFilter)
}
