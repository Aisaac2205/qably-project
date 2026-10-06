import { describe, expect, it } from 'vitest'
import { SUITE_SUMMARY_SORTS, type Suite, type SuiteSummarySort } from '@qably/types'
import { ApiError } from '@/lib/api-client'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { pageSuiteSummaries } from '@/test/suite-summaries-stub-page'
import type { SuiteRunSource } from '@/test/suite-summaries-stub'
import { PROJECT, casesOf, idsOf, numbered, run, suite } from '@/test/suite-summaries-fixtures'

function pageOf(
  suites: Suite[],
  overrides: Partial<ListSuiteSummariesParams> = {},
  runs: SuiteRunSource[] = [],
) {
  return pageSuiteSummaries(suites, runs, { projectId: PROJECT, sort: 'recent', ...overrides })
}

function failureOf(call: () => unknown): unknown {
  try {
    call()
  } catch (error) {
    return error
  }

  throw new Error('the stub accepted the request')
}

function collectAllIds(
  suites: Suite[],
  runs: SuiteRunSource[],
  sort: SuiteSummarySort,
  limit: number,
): string[] {
  const collected: string[] = []
  let cursor: string | undefined

  for (let guard = 0; guard < 50; guard += 1) {
    const page = pageOf(suites, { sort, limit, ...(cursor === undefined ? {} : { cursor }) }, runs)
    collected.push(...idsOf(page.items))
    if (page.nextCursor === null) return collected
    cursor = page.nextCursor
  }

  throw new Error('the cursor never ran out')
}

describe('pageSuiteSummaries', () => {
  it('returns only the items and the next cursor', () => {
    expect(Object.keys(pageOf([suite('s1')])).sort()).toEqual(['items', 'nextCursor'])
  })

  it('returns an empty page for a project without suites', () => {
    expect(pageOf([suite('a1')], { projectId: 'proj-9' })).toStrictEqual({
      items: [],
      nextCursor: null,
    })
  })

  describe('pagination', () => {
    it('serves fifty items by default and the rest on the next page', () => {
      const suites = numbered(60)

      const first = pageOf(suites)
      const second = pageOf(suites, { cursor: first.nextCursor ?? '' })

      expect(first.items).toHaveLength(50)
      expect(first.nextCursor).not.toBeNull()
      expect(second.items).toHaveLength(10)
      expect(second.nextCursor).toBeNull()
      expect([...idsOf(first.items), ...idsOf(second.items)]).toEqual(
        numbered(60)
          .map((item) => item.id)
          .reverse(),
      )
    })

    it('ends the pages with a null cursor only when no item is left', () => {
      const suites = numbered(5)

      const exact = pageOf(suites, { limit: 5 })
      const short = pageOf(suites, { limit: 4 })
      const rest = pageOf(suites, { limit: 4, cursor: short.nextCursor ?? '' })

      expect(exact.nextCursor).toBeNull()
      expect(short.items).toHaveLength(4)
      expect(short.nextCursor).not.toBeNull()
      expect(idsOf(rest.items)).toEqual(['s000'])
      expect(rest.nextCursor).toBeNull()
    })

    it('issues a string cursor that is not an item id', () => {
      const { nextCursor } = pageOf(numbered(3), { limit: 1 })

      expect(typeof nextCursor).toBe('string')
      expect(numbered(3).map((item) => item.id)).not.toContain(nextCursor)
    })

    it('continues strictly after the item the cursor points at', () => {
      const suites = numbered(6)
      const first = pageOf(suites, { limit: 2 })

      const second = pageOf(suites, { limit: 2, cursor: first.nextCursor ?? '' })

      expect(idsOf(first.items)).toEqual(['s005', 's004'])
      expect(idsOf(second.items)).toEqual(['s003', 's002'])
    })

    it('does not repeat or skip an item when a newer suite appears between pages', () => {
      const suites = numbered(5)
      const first = pageOf(suites, { limit: 2 })
      const withNewcomer = [
        ...suites,
        suite('newcomer', { createdAt: '2026-06-01T00:00:00.000Z' }),
      ]

      const second = pageOf(withNewcomer, { limit: 2, cursor: first.nextCursor ?? '' })

      expect(idsOf(first.items)).toEqual(['s004', 's003'])
      expect(idsOf(second.items)).toEqual(['s002', 's001'])
    })

    it('resumes from the position of a suite that was deleted after the cursor was issued', () => {
      const suites = numbered(5)
      const first = pageOf(suites, { limit: 2 })
      const withoutLast = suites.filter((item) => item.id !== 's003')

      const second = pageOf(withoutLast, { limit: 2, cursor: first.nextCursor ?? '' })

      expect(idsOf(second.items)).toEqual(['s002', 's001'])
    })

    describe.each(SUITE_SUMMARY_SORTS)('under the %s sort', (sort) => {
      const suites = [
        suite('s1', { name: 'beta', createdAt: '2026-01-01T00:00:00.000Z', cases: casesOf(3) }),
        suite('s2', { name: 'Alpha', createdAt: '2026-01-02T00:00:00.000Z', cases: casesOf(10) }),
        suite('s3', { name: 'alpha', createdAt: '2026-01-02T00:00:00.000Z', cases: casesOf(0) }),
        suite('s4', { name: 'Gamma', createdAt: '2026-01-03T00:00:00.000Z', cases: casesOf(3) }),
        suite('s5', { name: 'delta', createdAt: '2026-01-04T00:00:00.000Z', cases: casesOf(3) }),
        suite('s6', { name: 'Epsilon', createdAt: '2026-01-04T00:00:00.000Z', cases: casesOf(1) }),
        suite('s7', { name: 'zeta', createdAt: '2026-01-05T00:00:00.000Z', cases: casesOf(0) }),
      ]
      const runs = [
        run('r1', 's1', 'pass', '2026-03-01T00:00:00Z'),
        run('r2', 's2', 'pass', '2026-03-01T00:00:00Z'),
        run('r3', 's2', 'fail', '2026-03-02T00:00:00Z'),
        run('r4', 's4', 'pass', '2026-03-01T00:00:00Z'),
        run('r5', 's5', 'fail', '2026-03-01T00:00:00Z'),
        run('r6', 's7', 'pass', '2026-03-01T00:00:00Z'),
      ]

      it('walks every suite exactly once, in the order of a single page', () => {
        const single = collectAllIds(suites, runs, sort, 100)
        const paged = collectAllIds(suites, runs, sort, 2)

        expect(single).toHaveLength(7)
        expect(new Set(single).size).toBe(7)
        expect(paged).toEqual(single)
      })
    })
  })

  describe('invalid requests', () => {
    it('rejects a limit the API rejects, with the API validation error', () => {
      const failure = failureOf(() => pageOf(numbered(3), { limit: 0 }))

      expect(failure).toBeInstanceOf(ApiError)
      expect(failure).toMatchObject({
        status: 400,
        message: 'Validation failed',
        code: undefined,
        details: { issues: [{ path: 'limit' }] },
      })
    })

    it('rejects a cursor it did not issue on the cursor field', () => {
      const failure = failureOf(() => pageOf(numbered(3), { cursor: 'not-a-cursor' }))

      expect(failure).toBeInstanceOf(ApiError)
      expect(failure).toMatchObject({ status: 400, details: { issues: [{ path: 'cursor' }] } })
    })

    it('rejects a cursor that was issued for another sort', () => {
      const { nextCursor } = pageOf(numbered(3), { sort: 'recent', limit: 1 })

      const failure = failureOf(() =>
        pageOf(numbered(3), { sort: 'name', cursor: nextCursor ?? '' }),
      )

      expect(nextCursor).not.toBeNull()
      expect(failure).toMatchObject({ status: 400, details: { issues: [{ path: 'cursor' }] } })
    })

    it('rejects an empty project id instead of answering with an empty page', () => {
      const failure = failureOf(() => pageOf(numbered(3), { projectId: '' }))

      expect(failure).toMatchObject({ status: 400, details: { issues: [{ path: 'projectId' }] } })
    })

    it('trims the search before it filters', () => {
      expect(idsOf(pageOf(numbered(3), { search: '  suite  ' }).items)).toEqual([
        's002',
        's001',
        's000',
      ])
    })

    it('filters by a tag of 40 characters', () => {
      const longTag = 't'.repeat(40)
      const suites = [suite('tagged', { tags: [longTag] }), suite('plain')]

      expect(idsOf(pageOf(suites, { tag: longTag }).items)).toEqual(['tagged'])
    })
  })
})
