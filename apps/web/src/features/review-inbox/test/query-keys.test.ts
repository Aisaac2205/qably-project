import { describe, expect, it } from 'vitest'
import { reviewKeys } from '../lib/query-keys'

describe('reviewKeys.inbox', () => {
  it('keeps one cache entry per batch so a filtered queue never shows the full one', () => {
    const everything = reviewKeys.inbox({ status: 'in_review' })
    const batch = reviewKeys.inbox({ status: 'in_review', batch: 'batch-7' })
    const otherBatch = reviewKeys.inbox({ status: 'in_review', batch: 'batch-8' })

    expect(batch).not.toEqual(everything)
    expect(batch).not.toEqual(otherBatch)
  })

  it('treats a missing batch and an empty one as the same unfiltered queue', () => {
    expect(reviewKeys.inbox({ status: 'in_review', batch: '' })).toEqual(
      reviewKeys.inbox({ status: 'in_review' }),
    )
  })

  it('stays under the inbox prefix that decisions and count changes invalidate', () => {
    expect(reviewKeys.inbox({ status: 'all', batch: 'batch-7' }).slice(0, 2)).toEqual([
      'review',
      'inbox',
    ])
  })
})
