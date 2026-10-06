import { describe, expect, it } from 'vitest'
import { SUITE_RUN_STATUSES, SUITE_SUMMARY_SORTS } from '@qably/types'
import {
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
