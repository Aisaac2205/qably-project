import { describe, expect, it } from 'vitest'
import { SUITE_RUN_STATUSES, SUITE_SUMMARY_SORTS } from '@qably/types'
import {
  hasSummariesFilter,
  toSuiteSummariesQuery,
  type SuiteSummariesFilters,
} from '@/features/projects/suites/lib/suite-summaries-query'

const NO_FILTERS: SuiteSummariesFilters = {
  sort: 'recent',
  search: '',
  status: 'all',
  tag: 'all',
}

describe('toSuiteSummariesQuery', () => {
  it('keeps only the sort when no filter is active', () => {
    expect(toSuiteSummariesQuery(NO_FILTERS)).toStrictEqual({ sort: 'recent' })
  })

  it.each(SUITE_SUMMARY_SORTS)('keeps the %s sort', (sort) => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, sort })).toStrictEqual({ sort })
  })

  it('keeps every active filter next to the sort', () => {
    expect(
      toSuiteSummariesQuery({ sort: 'name', search: 'checkout', status: 'fail', tag: 'api' }),
    ).toStrictEqual({ sort: 'name', search: 'checkout', status: 'fail', tag: 'api' })
  })

  it('trims the search', () => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search: '  abc ' })).toStrictEqual({
      sort: 'recent',
      search: 'abc',
    })
  })

  it.each([201, 300])('caps a search of %i characters at the 200 the API accepts', (length) => {
    const search = `${'a'.repeat(199)}${'b'.repeat(length - 199)}`

    const query = toSuiteSummariesQuery({ ...NO_FILTERS, search })

    expect(query.search).toBe(`${'a'.repeat(199)}b`)
    expect(query.search).toHaveLength(200)
  })

  it('keeps a search of exactly 200 characters whole', () => {
    const search = 'c'.repeat(200)

    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search }).search).toBe(search)
  })

  it('trims before capping so the padding never eats into the 200 characters', () => {
    const search = `   ${'d'.repeat(200)}   `

    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search }).search).toBe('d'.repeat(200))
  })

  it('never lets the cap leave a space at the end of the key', () => {
    const search = `${'a'.repeat(199)} ${'b'.repeat(10)}`

    const query = toSuiteSummariesQuery({ ...NO_FILTERS, search })

    expect(query.search).toBe('a'.repeat(199))
    expect(query.search?.endsWith(' ')).toBe(false)
  })

  it('trims again when the cap falls inside a run of spaces', () => {
    const search = `a${' '.repeat(250)}b`

    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search }).search).toBe('a')
  })

  it('keeps the spaces inside a search that the cap does not cut', () => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search: 'login  flow' }).search).toBe(
      'login  flow',
    )
  })

  it('drops a search made only of whitespace', () => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, search: '   ' })).toStrictEqual({
      sort: 'recent',
    })
  })

  it.each(SUITE_RUN_STATUSES)('keeps the %s status', (status) => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, status })).toStrictEqual({
      sort: 'recent',
      status,
    })
  })

  it('drops the all status sentinel', () => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, status: 'all' })).not.toHaveProperty('status')
  })

  it('keeps a tag exactly as typed, including its case', () => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, tag: 'API' })).toStrictEqual({
      sort: 'recent',
      tag: 'API',
    })
  })

  it.each(['all', ''])('drops the %j tag', (tag) => {
    expect(toSuiteSummariesQuery({ ...NO_FILTERS, tag })).not.toHaveProperty('tag')
  })
})

describe('hasSummariesFilter', () => {
  it.each(SUITE_SUMMARY_SORTS)('is false with only the %s sort', (sort) => {
    expect(hasSummariesFilter({ ...NO_FILTERS, sort })).toBe(false)
  })

  it.each([
    ['a search', { search: 'login' }],
    ['a status', { status: 'fail' as const }],
    ['a tag', { tag: 'smoke' }],
    ['every filter', { search: 'login', status: 'pass' as const, tag: 'api' }],
  ])('is true with %s', (_label, filters) => {
    expect(hasSummariesFilter({ ...NO_FILTERS, ...filters })).toBe(true)
  })

  it.each([
    ['a search of only whitespace', { search: '   ' }],
    ['an empty tag', { tag: '' }],
    ['the all sentinels', { status: 'all' as const, tag: 'all' }],
  ])('is false with %s, which the server never receives', (_label, filters) => {
    expect(hasSummariesFilter({ ...NO_FILTERS, ...filters })).toBe(false)
  })

  it('looks at the search once it is trimmed', () => {
    expect(hasSummariesFilter({ ...NO_FILTERS, search: '  a ' })).toBe(true)
  })
})
