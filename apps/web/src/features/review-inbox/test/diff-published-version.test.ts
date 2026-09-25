import { describe, it, expect } from 'vitest'
import { diffAgainstPublishedVersion } from '@/features/review-inbox/lib/diff-published-version'

const published = {
  title: 'Empties the cart',
  objective: 'Confirm the cart resets',
  preconditions: ['A signed-in user'],
  steps: ['Open the cart', 'Remove every item'],
  expectedResult: 'The cart shows zero items',
}

describe('diffAgainstPublishedVersion', () => {
  it('returns null when there is no published version to compare against', () => {
    expect(diffAgainstPublishedVersion(published, null)).toBeNull()
  })

  it('reports no changes when every field matches the published version', () => {
    const diff = diffAgainstPublishedVersion({ ...published }, published)

    expect(diff).toEqual({ scalarChanges: [], listChanges: [], hasChanges: false })
  })

  it('reports a scalar change for a modified objective', () => {
    const diff = diffAgainstPublishedVersion(
      { ...published, objective: 'Confirm the cart is empty' },
      published,
    )

    expect(diff?.hasChanges).toBe(true)
    expect(diff?.scalarChanges).toEqual([
      { field: 'objective', previous: 'Confirm the cart resets', next: 'Confirm the cart is empty' },
    ])
  })

  it('reports added and removed steps without flagging unchanged ones', () => {
    const diff = diffAgainstPublishedVersion(
      { ...published, steps: ['Open the cart', 'Apply a coupon'] },
      published,
    )

    expect(diff?.listChanges).toEqual([
      { field: 'steps', added: ['Apply a coupon'], removed: ['Remove every item'] },
    ])
  })

  it('reports added and removed preconditions independently from steps', () => {
    const diff = diffAgainstPublishedVersion(
      { ...published, preconditions: ['A signed-in admin'] },
      published,
    )

    expect(diff?.listChanges).toEqual([
      { field: 'preconditions', added: ['A signed-in admin'], removed: ['A signed-in user'] },
    ])
    expect(diff?.listChanges.some((change) => change.field === 'steps')).toBe(false)
  })

  it('reports a title change alongside other scalar changes', () => {
    const diff = diffAgainstPublishedVersion(
      { ...published, title: 'Empties the mini basket', expectedResult: 'The mini basket is empty' },
      published,
    )

    expect(diff?.scalarChanges).toEqual([
      { field: 'title', previous: 'Empties the cart', next: 'Empties the mini basket' },
      {
        field: 'expectedResult',
        previous: 'The cart shows zero items',
        next: 'The mini basket is empty',
      },
    ])
  })
})
