import { describe, expect, it } from 'vitest'
import { countByStatus, filterByStatus, scopeProposals } from '../lib/filter-proposals'
import type { ProposalListItem } from '../api/review.api'

function proposal(overrides: Partial<ProposalListItem> = {}): ProposalListItem {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status: 'in_review',
    title: 'Empties the cart',
    objective: 'Confirm the cart resets',
    preconditions: [],
    steps: ['Open the cart'],
    expectedResult: 'The cart shows zero items',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: 'src/cart.spec.ts',
    needsManualReview: false,
    ...overrides,
  }
}

describe('scopeProposals', () => {
  it('excludes proposals outside the selected project', () => {
    const proposals = [proposal({ id: 'a', projectId: 'project-1' }), proposal({ id: 'b', projectId: 'project-2' })]

    const scoped = scopeProposals(proposals, {
      selectedProjectId: 'project-1',
      duplicateOnly: false,
      searchQuery: '',
      projectNameById: new Map(),
    })

    expect(scoped.map((p) => p.id)).toEqual(['a'])
  })

  it('keeps only flagged duplicates when duplicateOnly is set', () => {
    const proposals = [
      proposal({ id: 'dup', possibleDuplicate: true }),
      proposal({ id: 'fresh', possibleDuplicate: undefined }),
    ]

    const scoped = scopeProposals(proposals, {
      selectedProjectId: 'all',
      duplicateOnly: true,
      searchQuery: '',
      projectNameById: new Map(),
    })

    expect(scoped.map((p) => p.id)).toEqual(['dup'])
  })

  it('matches search against title, objective, or the project name', () => {
    const proposals = [
      proposal({ id: 'a', title: 'Empties the cart' }),
      proposal({ id: 'b', title: 'Checkout', objective: 'Confirm the order total' }),
    ]

    const scoped = scopeProposals(proposals, {
      selectedProjectId: 'all',
      duplicateOnly: false,
      searchQuery: 'cart',
      projectNameById: new Map(),
    })

    expect(scoped.map((p) => p.id)).toEqual(['a'])
  })

  it('matches search against the resolved project name', () => {
    const proposals = [proposal({ id: 'a', projectId: 'project-1', title: 'Checkout' })]

    const scoped = scopeProposals(proposals, {
      selectedProjectId: 'all',
      duplicateOnly: false,
      searchQuery: 'gizmo',
      projectNameById: new Map([['project-1', 'Checkout Suite']]),
    })

    expect(scoped.map((p) => p.id)).toEqual([])

    const matched = scopeProposals(proposals, {
      selectedProjectId: 'all',
      duplicateOnly: false,
      searchQuery: 'checkout',
      projectNameById: new Map([['project-1', 'Checkout Suite']]),
    })
    expect(matched.map((p) => p.id)).toEqual(['a'])
  })
})

describe('countByStatus', () => {
  it('counts each status plus the all bucket', () => {
    const proposals = [
      proposal({ id: 'a', status: 'in_review' }),
      proposal({ id: 'b', status: 'approved' }),
      proposal({ id: 'c', status: 'rejected' }),
      proposal({ id: 'd', status: 'in_review' }),
    ]

    expect(countByStatus(proposals)).toEqual({
      all: 4,
      in_review: 2,
      approved: 1,
      rejected: 1,
    })
  })
})

describe('filterByStatus', () => {
  it('returns every proposal when the filter is all', () => {
    const proposals = [proposal({ id: 'a', status: 'approved' }), proposal({ id: 'b', status: 'rejected' })]

    expect(filterByStatus(proposals, 'all').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('filters down to a single status', () => {
    const proposals = [proposal({ id: 'a', status: 'approved' }), proposal({ id: 'b', status: 'rejected' })]

    expect(filterByStatus(proposals, 'approved').map((p) => p.id)).toEqual(['a'])
  })
})
