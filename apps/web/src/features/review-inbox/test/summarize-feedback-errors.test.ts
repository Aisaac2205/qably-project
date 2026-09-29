import { describe, expect, it } from 'vitest'
import type { InboxFeedbackToast } from '../hooks/use-inbox-feedback'
import { MAX_VISIBLE_ERRORS, summarizeErrors } from '../lib/summarize-feedback-errors'

function error(id: number, message: string, href?: string): InboxFeedbackToast {
  return { id, message, type: 'error', ...(href === undefined ? {} : { href, linkLabel: 'View' }) }
}

describe('summarizeErrors', () => {
  it('shows at most three errors', () => {
    expect(MAX_VISIBLE_ERRORS).toBe(3)
  })

  it('shows every error when they fit within the cap', () => {
    const summary = summarizeErrors([error(1, 'A'), error(2, 'B'), error(3, 'C')])

    expect(summary.visible.map((group) => group.toast.message)).toEqual(['A', 'B', 'C'])
    expect(summary.hiddenCount).toBe(0)
    expect(summary.hiddenIds).toEqual([])
  })

  it('keeps only the newest errors and reports how many were left out', () => {
    const summary = summarizeErrors([
      error(1, 'A'),
      error(2, 'B'),
      error(3, 'C'),
      error(4, 'D'),
      error(5, 'E'),
    ])

    expect(summary.visible.map((group) => group.toast.message)).toEqual(['C', 'D', 'E'])
    expect(summary.hiddenCount).toBe(2)
    expect(summary.hiddenIds).toEqual([1, 2])
  })

  it('merges identical messages into one entry that counts them and keeps every id', () => {
    const summary = summarizeErrors([error(1, 'Try again.'), error(2, 'Try again.'), error(3, 'Try again.')])

    expect(summary.visible).toHaveLength(1)
    expect(summary.visible[0].count).toBe(3)
    expect(summary.visible[0].ids).toEqual([1, 2, 3])
    expect(summary.visible[0].toast.id).toBe(3)
  })

  it('places a merged entry where its newest occurrence arrived', () => {
    const summary = summarizeErrors([error(1, 'Try again.'), error(2, 'B'), error(3, 'Try again.')])

    expect(summary.visible.map((group) => group.toast.message)).toEqual(['B', 'Try again.'])
  })

  it('keeps identical messages apart when they link to different cases', () => {
    const summary = summarizeErrors([
      error(1, 'Same text.', '/cases/a'),
      error(2, 'Same text.', '/cases/b'),
    ])

    expect(summary.visible).toHaveLength(2)
    expect(summary.visible.every((group) => group.count === 1)).toBe(true)
  })

  it('counts the errors left out, not the entries they were merged into', () => {
    const summary = summarizeErrors([
      error(1, 'Try again.'),
      error(2, 'Try again.'),
      error(3, 'B'),
      error(4, 'C'),
      error(5, 'D'),
      error(6, 'E'),
    ])

    expect(summary.visible.map((group) => group.toast.message)).toEqual(['C', 'D', 'E'])
    expect(summary.hiddenCount).toBe(3)
    expect(summary.hiddenIds).toEqual([1, 2, 3])
  })
})
