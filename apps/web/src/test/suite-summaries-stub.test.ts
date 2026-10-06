import { describe, expect, it } from 'vitest'
import type { Suite } from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { createMockTestCase } from '@/lib/test-utils'
import {
  collectProjectSuiteTags,
  orderSuiteSummaries,
  type SuiteRunSource,
} from '@/test/suite-summaries-stub'
import { PROJECT, casesOf, idsOf, run, suite } from '@/test/suite-summaries-fixtures'

function orderOf(
  suites: Suite[],
  overrides: Partial<ListSuiteSummariesParams> = {},
  runs: SuiteRunSource[] = [],
) {
  return orderSuiteSummaries(suites, runs, { projectId: PROJECT, sort: 'recent', ...overrides })
}

describe('orderSuiteSummaries', () => {
  describe('items', () => {
    it('maps a suite to the summary shape the API emits', () => {
      const source = suite('s1', {
        name: 'Authentication',
        description: 'Login flows.',
        tags: ['auth', 'smoke'],
        isDefault: true,
        createdAt: '2026-01-25T00:00:00Z',
        cases: [
          createMockTestCase({ id: 'c1', state: 'active' }),
          createMockTestCase({ id: 'c2', state: 'draft' }),
          createMockTestCase({ id: 'c3', state: 'deprecated' }),
        ],
      })
      const runs = [
        run('r1', 's1', 'pass', '2026-02-01T00:00:00Z'),
        run('r2', 's1', 'fail', '2026-02-02T00:00:00Z'),
      ]

      expect(orderOf([source], {}, runs)).toStrictEqual([
        {
          id: 's1',
          projectId: PROJECT,
          name: 'Authentication',
          description: 'Login flows.',
          tags: ['auth', 'smoke'],
          isDefault: true,
          createdAt: '2026-01-25T00:00:00.000Z',
          caseCount: 3,
          status: 'needs-attention',
          recentPassRate: 50,
        },
      ])
    })

    it('counts zero cases for a suite without cases', () => {
      expect(orderOf([suite('s1')])[0]?.caseCount).toBe(0)
    })

    it('lists only the suites of the requested project', () => {
      const suites = [suite('a1'), suite('b1', { projectId: 'proj-2' })]

      expect(idsOf(orderOf(suites))).toEqual(['a1'])
      expect(idsOf(orderOf(suites, { projectId: 'proj-2' }))).toEqual(['b1'])
    })

    it('lists nothing for a project without suites', () => {
      expect(orderOf([suite('a1')], { projectId: 'proj-9' })).toEqual([])
    })
  })

  describe('status', () => {
    it('derives the status from the ten most recent runs of the suite', () => {
      const fails = Array.from({ length: 5 }, (_, index) =>
        run(`f${index}`, 's1', 'fail', `2026-03-0${index + 1}T00:00:00Z`),
      )
      const passes = Array.from({ length: 7 }, (_, index) =>
        run(`p${index}`, 's1', 'pass', `2026-03-1${index}T00:00:00Z`),
      )

      const [item] = orderOf([suite('s1')], {}, [...fails, ...passes])

      expect(item).toMatchObject({ status: 'pass', recentPassRate: 70 })
    })

    it('treats the run with the higher id as the most recent when two share a start time', () => {
      const earlier = Array.from({ length: 9 }, (_, index) =>
        run(`p${index}`, 's1', 'pass', `2026-03-0${index + 1}T00:00:00Z`),
      )
      const tied = [
        run('run-1', 's1', 'pass', '2026-04-01T00:00:00Z'),
        run('run-2', 's1', 'fail', '2026-04-01T00:00:00Z'),
      ]

      const [item] = orderOf([suite('s1')], {}, [...tied, ...earlier])

      expect(item).toMatchObject({ status: 'fail', recentPassRate: 90 })
    })

    it('reports running while a run in the window is running', () => {
      const runs = [
        run('r1', 's1', 'running', '2026-03-01T00:00:00Z'),
        run('r2', 's1', 'pass', '2026-03-02T00:00:00Z'),
      ]

      expect(orderOf([suite('s1')], {}, runs)[0]).toMatchObject({
        status: 'running',
        recentPassRate: 100,
      })
    })

    it('ignores the runs of other suites', () => {
      const runs = [
        run('r1', 's1', 'pass', '2026-03-01T00:00:00Z'),
        run('r2', 's2', 'running', '2026-03-02T00:00:00Z'),
      ]

      const items = orderOf([suite('s1'), suite('s2')], {}, runs)

      expect(items.map(({ id, status }) => [id, status])).toEqual([
        ['s2', 'running'],
        ['s1', 'pass'],
      ])
    })

    it('reports never-run with no pass rate for a suite without runs', () => {
      expect(orderOf([suite('s1')])[0]).toMatchObject({
        status: 'never-run',
        recentPassRate: null,
      })
    })
  })

  describe('filters', () => {
    const suites = [
      suite('login', { name: 'Login', description: 'flow', tags: ['api', 'smoke'] }),
      suite('pay', { name: 'Payments', description: 'Card and refund flows', tags: ['API'] }),
      suite('cart', { name: 'Cart', description: '', tags: ['api-v2'] }),
    ]
    const runs = [
      run('r1', 'login', 'pass', '2026-03-01T00:00:00Z'),
      run('r2', 'pay', 'running', '2026-03-01T00:00:00Z'),
    ]

    it('searches the name and the description case-insensitively', () => {
      expect(idsOf(orderOf(suites, { search: 'LOGIN' }))).toEqual(['login'])
      expect(idsOf(orderOf(suites, { search: 'flow' }))).toEqual(['pay', 'login'])
    })

    it('searches each field on its own instead of one concatenated text', () => {
      expect(idsOf(orderOf(suites, { search: 'login flow' }))).toEqual([])
      expect(idsOf(orderOf(suites, { search: 'login' }))).toEqual(['login'])
    })

    it('trims the search', () => {
      expect(idsOf(orderOf(suites, { search: '  login ' }))).toEqual(['login'])
    })

    it('matches a tag exactly and with its case', () => {
      expect(idsOf(orderOf(suites, { tag: 'api' }))).toEqual(['login'])
      expect(idsOf(orderOf(suites, { tag: 'API' }))).toEqual(['pay'])
      expect(idsOf(orderOf(suites, { tag: 'api-v2' }))).toEqual(['cart'])
      expect(idsOf(orderOf(suites, { tag: 'missing' }))).toEqual([])
    })

    it('filters by the derived status', () => {
      expect(idsOf(orderOf(suites, { status: 'pass' }, runs))).toEqual(['login'])
      expect(idsOf(orderOf(suites, { status: 'running' }, runs))).toEqual(['pay'])
      expect(idsOf(orderOf(suites, { status: 'never-run' }, runs))).toEqual(['cart'])
      expect(idsOf(orderOf(suites, { status: 'fail' }, runs))).toEqual([])
    })

    it('combines search, tag and status', () => {
      expect(idsOf(orderOf(suites, { search: 'flow', status: 'running' }, runs))).toEqual(['pay'])
      expect(idsOf(orderOf(suites, { search: 'flow', tag: 'api' }, runs))).toEqual(['login'])
      expect(
        idsOf(orderOf(suites, { search: 'flow', tag: 'api', status: 'running' }, runs)),
      ).toEqual([])
    })
  })

  describe('sorting', () => {
    it('puts the most recent suite first and breaks ties by id descending', () => {
      const suites = [
        suite('a', { createdAt: '2026-01-01T00:00:00.000Z' }),
        suite('b', { createdAt: '2026-01-03T00:00:00.000Z' }),
        suite('c', { createdAt: '2026-01-03T00:00:00.000Z' }),
        suite('d', { createdAt: '2026-01-02T00:00:00.000Z' }),
      ]

      expect(idsOf(orderOf(suites, { sort: 'recent' }))).toEqual(['c', 'b', 'd', 'a'])
    })

    it('compares creation instants and not their text', () => {
      const suites = [
        suite('plain', { createdAt: '2026-01-01T00:00:00Z' }),
        suite('millis', { createdAt: '2026-01-01T00:00:00.500Z' }),
      ]

      expect(idsOf(orderOf(suites, { sort: 'recent' }))).toEqual(['millis', 'plain'])
    })

    it('sorts by name ignoring case and breaks ties by id ascending', () => {
      const suites = [
        suite('b1', { name: 'beta' }),
        suite('a2', { name: 'alpha' }),
        suite('a1', { name: 'Alpha' }),
        suite('g1', { name: 'Gamma' }),
      ]

      expect(idsOf(orderOf(suites, { sort: 'name' }))).toEqual(['a1', 'a2', 'b1', 'g1'])
    })

    it('sorts by pass rate with suites that never ran last', () => {
      const suites = [
        suite('t1-high', { createdAt: '2026-01-01T00:00:00.000Z' }),
        suite('half'),
        suite('none'),
        suite('t2-high', { createdAt: '2026-01-02T00:00:00.000Z' }),
      ]
      const runs = [
        run('r1', 't1-high', 'pass', '2026-03-01T00:00:00Z'),
        run('r2', 't2-high', 'pass', '2026-03-01T00:00:00Z'),
        run('r3', 'half', 'pass', '2026-03-01T00:00:00Z'),
        run('r4', 'half', 'fail', '2026-03-02T00:00:00Z'),
      ]

      expect(idsOf(orderOf(suites, { sort: 'pass-rate' }, runs))).toEqual([
        't2-high',
        't1-high',
        'half',
        'none',
      ])
    })

    it('sorts by case count, then by creation, with empty suites last', () => {
      const suites = [
        suite('t1-three', { createdAt: '2026-01-01T00:00:00.000Z', cases: casesOf(3) }),
        suite('ten', { cases: casesOf(10) }),
        suite('none'),
        suite('t2-three', { createdAt: '2026-01-02T00:00:00.000Z', cases: casesOf(3) }),
      ]

      expect(idsOf(orderOf(suites, { sort: 'cases' }))).toEqual([
        'ten',
        't2-three',
        't1-three',
        'none',
      ])
    })
  })
})

describe('collectProjectSuiteTags', () => {
  it('lists the distinct tags of one project in code unit order', () => {
    const suites = [
      suite('a', { tags: ['b', 'a'] }),
      suite('b', { tags: ['b', 'C'] }),
      suite('c', { tags: [] }),
      suite('d', { projectId: 'proj-2', tags: ['zzz'] }),
    ]

    expect(collectProjectSuiteTags(suites, PROJECT)).toEqual({ items: ['C', 'a', 'b'] })
  })

  it('returns no tags for a project without suites', () => {
    expect(collectProjectSuiteTags([suite('a', { tags: ['x'] })], 'proj-9')).toEqual({
      items: [],
    })
  })
})
