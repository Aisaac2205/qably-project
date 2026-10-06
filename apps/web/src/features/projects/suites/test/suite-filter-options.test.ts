import { describe, expect, it } from 'vitest'
import { withActiveTag } from '@/features/projects/suites/lib/suite-filter-options'

describe('withActiveTag', () => {
  it('returns the tags as they are while no tag is active', () => {
    expect(withActiveTag(['auth', 'smoke'], 'all')).toEqual(['auth', 'smoke'])
  })

  it('returns the tags as they are when the active tag is one of them', () => {
    expect(withActiveTag(['auth', 'smoke'], 'smoke')).toEqual(['auth', 'smoke'])
  })

  it('adds an active tag that the tags lack, in the order of the tags', () => {
    expect(withActiveTag(['auth', 'smoke'], 'checkout')).toEqual(['auth', 'checkout', 'smoke'])
    expect(withActiveTag(['auth', 'smoke'], 'zeta')).toEqual(['auth', 'smoke', 'zeta'])
  })

  it('orders by code units, as the tag list of the API does, so capitals come first', () => {
    expect(withActiveTag(['B', 'a'], 'C')).toEqual(['B', 'C', 'a'])
  })

  it('offers the active tag alone when there are no tags at all', () => {
    expect(withActiveTag([], 'smoke')).toEqual(['smoke'])
  })

  it('leaves the tags it receives untouched', () => {
    const tags = Object.freeze(['auth', 'smoke'])

    expect(withActiveTag(tags, 'checkout')).toEqual(['auth', 'checkout', 'smoke'])
    expect(tags).toEqual(['auth', 'smoke'])
  })
})
