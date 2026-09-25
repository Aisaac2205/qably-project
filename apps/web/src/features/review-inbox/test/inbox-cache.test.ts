import { describe, it, expect } from 'vitest'
import {
  removeFromPages,
  reinsertAt,
  adjustCounts,
} from '@/features/review-inbox/lib/inbox-cache'
import type { ReviewInboxPageResult, ProposalListItem } from '@/features/review-inbox/api/review.api'
import type { InfiniteData } from '@tanstack/react-query'

function proposal(id: string): ProposalListItem {
  return {
    id,
    projectId: 'p1',
    status: 'in_review',
    title: `Proposal ${id}`,
    objective: 'objective',
    preconditions: [],
    steps: ['step'],
    expectedResult: 'result',
    priority: 'medium',
    evidenceId: 'ev-1',
    evidenceTitle: 'evidence',
    needsManualReview: false,
  }
}

function page(...ids: string[]): ReviewInboxPageResult {
  return { items: ids.map(proposal), nextCursor: null }
}

describe('removeFromPages', () => {
  it('returns undefined data unchanged when the cache has no data yet', () => {
    const result = removeFromPages(undefined, 'a')

    expect(result).toEqual({ data: undefined, removed: null })
  })

  it('removes the item from the page that contains it and records its position', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a', 'b'), page('c')],
      pageParams: [null, 'cursor-1'],
    }

    const result = removeFromPages(data, 'b')

    expect(result.data?.pages[0].items.map((i) => i.id)).toEqual(['a'])
    expect(result.data?.pages[1].items.map((i) => i.id)).toEqual(['c'])
    expect(result.removed).toEqual({
      pageIndex: 0,
      itemIndex: 1,
      item: proposal('b'),
    })
  })

  it('reports removed: null and leaves data untouched when the id is not in any page', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a', 'b')],
      pageParams: [null],
    }

    const result = removeFromPages(data, 'missing')

    expect(result.removed).toBeNull()
    expect(result.data).toBe(data)
  })
})

describe('reinsertAt', () => {
  it('puts the item back at its recorded page and index', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a'), page('c')],
      pageParams: [null, 'cursor-1'],
    }

    const result = reinsertAt(data, {
      pageIndex: 0,
      itemIndex: 1,
      item: proposal('b'),
    })

    expect(result?.pages[0].items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(result?.pages[1].items.map((i) => i.id)).toEqual(['c'])
  })

  it('clamps the index when the page shrank since the item was removed', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a')],
      pageParams: [null],
    }

    const result = reinsertAt(data, {
      pageIndex: 0,
      itemIndex: 9,
      item: proposal('b'),
    })

    expect(result?.pages[0].items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('returns the data unchanged when the recorded page no longer exists', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a')],
      pageParams: [null],
    }

    const result = reinsertAt(data, {
      pageIndex: 5,
      itemIndex: 0,
      item: proposal('b'),
    })

    expect(result).toBe(data)
  })

  it('returns undefined data unchanged when the cache has no data yet', () => {
    const result = reinsertAt(undefined, {
      pageIndex: 0,
      itemIndex: 0,
      item: proposal('b'),
    })

    expect(result).toBeUndefined()
  })

  it('does not insert an item whose id already exists in any page (a refetch raced the rollback)', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a', 'b'), page('c')],
      pageParams: [null, 'cursor-1'],
    }

    const result = reinsertAt(data, {
      pageIndex: 0,
      itemIndex: 1,
      item: proposal('b'),
    })

    expect(result?.pages[0].items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(result).toBe(data)
  })

  it('does not insert a duplicate even when the id resurfaced on a different page than it was removed from', () => {
    const data: InfiniteData<ReviewInboxPageResult> = {
      pages: [page('a'), page('b', 'c')],
      pageParams: [null, 'cursor-1'],
    }

    const result = reinsertAt(data, {
      pageIndex: 0,
      itemIndex: 0,
      item: proposal('b'),
    })

    expect(result?.pages[0].items.map((i) => i.id)).toEqual(['a'])
    expect(result?.pages[1].items.map((i) => i.id)).toEqual(['b', 'c'])
    expect(result).toBe(data)
  })
})

describe('adjustCounts', () => {
  it('applies a negative delta to the named status, floored at zero', () => {
    const result = adjustCounts(
      { in_review: 1, approved: 3, rejected: 0, changes_requested: 0 },
      'in_review',
      -1,
    )

    expect(result).toEqual({ in_review: 0, approved: 3, rejected: 0, changes_requested: 0 })
  })

  it('never goes below zero even if the delta overshoots', () => {
    const result = adjustCounts(
      { in_review: 0, approved: 0, rejected: 0, changes_requested: 0 },
      'in_review',
      -1,
    )

    expect(result.in_review).toBe(0)
  })

  it('applies a positive delta without touching other statuses', () => {
    const result = adjustCounts(
      { in_review: 0, approved: 3, rejected: 0, changes_requested: 0 },
      'approved',
      1,
    )

    expect(result).toEqual({ in_review: 0, approved: 4, rejected: 0, changes_requested: 0 })
  })
})
