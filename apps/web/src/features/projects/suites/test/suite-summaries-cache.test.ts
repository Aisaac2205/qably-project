import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import {
  patchSuiteSummaries,
  type SuiteSummariesData,
} from '@/features/projects/suites/lib/suite-summaries-cache'
import { createMockTestCase } from '@/lib/test-utils'
import { casesOf, suite } from '@/test/suite-summaries-fixtures'
import { summary } from './suite-summaries-test-data'
import {
  LOOKALIKE_PROJECT,
  OTHER_PROJECT,
  RECENT,
  SEARCH,
  dataOf,
  idsIn,
  itemOf,
  itemsOf,
  seededClient,
} from './suite-summaries-cache-test-data'

describe('patchSuiteSummaries', () => {
  const edited = suite('c', {
    projectId: 'proj-1',
    name: 'Aardvark',
    description: 'fresh description',
    tags: ['new', 'tags'],
    isDefault: false,
    cases: casesOf(3),
  })

  it('patches the suite on every page of every filter variant of its project', () => {
    const client = seededClient()

    patchSuiteSummaries(client, edited)

    for (const key of [RECENT, SEARCH]) {
      expect(itemOf(client, key, 'c')).toMatchObject({
        name: 'Aardvark',
        description: 'fresh description',
        tags: ['new', 'tags'],
        isDefault: false,
        caseCount: 3,
      })
    }
  })

  it('keeps the derived status and pass rate the suite already had', () => {
    const client = seededClient()

    patchSuiteSummaries(client, edited)

    for (const key of [RECENT, SEARCH]) {
      expect(itemOf(client, key, 'c')).toMatchObject({
        status: 'needs-attention',
        recentPassRate: 60,
      })
    }
  })

  it('keeps every row where it was, even when the new name would sort elsewhere', () => {
    const client = seededClient()

    patchSuiteSummaries(client, edited)

    expect(idsIn(client, RECENT)).toEqual(['a', 'b', 'c', 'd'])
    expect(idsIn(client, SEARCH)).toEqual(['c', 'e'])
  })

  it('keeps the pages, their cursors and the page params untouched', () => {
    const client = seededClient()
    const before = client.getQueryData<SuiteSummariesData>(RECENT)

    patchSuiteSummaries(client, edited)

    const after = client.getQueryData<SuiteSummariesData>(RECENT)
    expect(after?.pageParams).toEqual(before?.pageParams)
    expect(after?.pages.map((page) => page.nextCursor)).toEqual(['cursor-1', null])
    expect(after?.pages.map((page) => page.items.length)).toEqual([2, 2])
  })

  it('leaves the other rows of the project as they were', () => {
    const client = seededClient()
    const before = itemsOf(client, RECENT).filter((item) => item.id !== 'c')

    patchSuiteSummaries(client, edited)

    expect(itemsOf(client, RECENT).filter((item) => item.id !== 'c')).toEqual(before)
  })

  it('counts every case of the suite, whatever its state', () => {
    const client = seededClient()
    const withDraftAndAutomated = suite('c', {
      projectId: 'proj-1',
      cases: [
        ...casesOf(1),
        createMockTestCase({ id: 'draft-case', state: 'draft' }),
        createMockTestCase({ id: 'old-case', state: 'deprecated' }),
        createMockTestCase({ id: 'auto-case', executionMode: 'automated' }),
      ],
    })

    patchSuiteSummaries(client, withDraftAndAutomated)

    expect(itemOf(client, RECENT, 'c')?.caseCount).toBe(4)
    expect(itemOf(client, SEARCH, 'c')?.caseCount).toBe(4)
  })

  it('drops the case count to zero when the last case is gone', () => {
    const client = seededClient()
    client.setQueryData(RECENT, dataOf([summary('c', { caseCount: 4 })]))

    patchSuiteSummaries(client, suite('c', { projectId: 'proj-1', cases: [] }))

    expect(itemOf(client, RECENT, 'c')?.caseCount).toBe(0)
  })

  it('leaves the summaries of another project alone, even one whose id starts the same', () => {
    const client = seededClient()
    const otherBefore = itemsOf(client, OTHER_PROJECT)
    const lookalikeBefore = itemsOf(client, LOOKALIKE_PROJECT)

    patchSuiteSummaries(client, edited)

    expect(itemsOf(client, OTHER_PROJECT)).toEqual(otherBefore)
    expect(itemsOf(client, LOOKALIKE_PROJECT)).toEqual(lookalikeBefore)
    expect(itemOf(client, LOOKALIKE_PROJECT, 'c')?.name).toBe('Same id, other project')
  })

  it('leaves the facet, the plain list and the detail caches alone', () => {
    const client = seededClient()

    patchSuiteSummaries(client, edited)

    expect(client.getQueryData(suiteKeys.tags('proj-1'))).toEqual({ items: ['old'] })
    expect(client.getQueryData(suiteKeys.list('proj-1'))).toEqual([suite('c')])
    expect(client.getQueryData(suiteKeys.detail('c'))).toEqual(suite('c'))
  })

  describe('when the suite becomes the default', () => {
    const crowned = suite('c', { projectId: 'proj-1', isDefault: true, cases: casesOf(1) })

    it('clears the default flag of every other suite of the project on every page and variant', () => {
      const client = seededClient()
      client.setQueryData(SEARCH, dataOf([summary('c'), summary('e', { isDefault: true })]))

      patchSuiteSummaries(client, crowned)

      expect(itemOf(client, RECENT, 'c')?.isDefault).toBe(true)
      expect(itemOf(client, SEARCH, 'c')?.isDefault).toBe(true)
      expect(itemOf(client, RECENT, 'a')?.isDefault).toBe(false)
      expect(itemOf(client, SEARCH, 'e')?.isDefault).toBe(false)
    })

    it('demotes the previous default even in a variant that does not hold the new one', () => {
      const client = seededClient()
      client.setQueryData(SEARCH, dataOf([summary('e', { isDefault: true }), summary('f')]))

      patchSuiteSummaries(client, crowned)

      expect(idsIn(client, SEARCH)).toEqual(['e', 'f'])
      expect(itemOf(client, SEARCH, 'e')?.isDefault).toBe(false)
    })

    it('does not demote the defaults of another project', () => {
      const client = seededClient()

      patchSuiteSummaries(client, crowned)

      expect(itemOf(client, OTHER_PROJECT, 'z')?.isDefault).toBe(true)
      expect(itemOf(client, LOOKALIKE_PROJECT, 'c')?.isDefault).toBe(true)
    })
  })

  it('keeps the default flag of the other suites when the patched one is not the default', () => {
    const client = seededClient()

    patchSuiteSummaries(client, edited)

    expect(itemOf(client, RECENT, 'a')?.isDefault).toBe(true)
  })

  describe('when the suite is not loaded', () => {
    const unknown = suite('unknown', { projectId: 'proj-1', name: 'Never seen' })

    it('changes no cached value and does not fail', () => {
      const client = seededClient()
      const keys = [RECENT, SEARCH, OTHER_PROJECT, LOOKALIKE_PROJECT]
      const before = keys.map((key) => client.getQueryData(key))

      expect(() => patchSuiteSummaries(client, unknown)).not.toThrow()

      keys.forEach((key, index) => expect(client.getQueryData(key)).toBe(before[index]))
    })

    it('does not write to the variants, so no observer is notified', () => {
      const client = seededClient()
      const writes = [RECENT, SEARCH].map((key) => client.getQueryState(key)?.dataUpdateCount)

      patchSuiteSummaries(client, unknown)

      expect([RECENT, SEARCH].map((key) => client.getQueryState(key)?.dataUpdateCount)).toEqual(
        writes,
      )
    })

    it('writes to the variants that do hold the suite', () => {
      const client = seededClient()
      const writes = client.getQueryState(RECENT)?.dataUpdateCount ?? 0

      patchSuiteSummaries(client, suite('c', { projectId: 'proj-1', name: 'Renamed' }))

      expect(client.getQueryState(RECENT)?.dataUpdateCount).toBe(writes + 1)
    })

    it('creates no cache entry for a project that has none', () => {
      const client = new QueryClient()

      patchSuiteSummaries(client, unknown)

      expect(client.getQueryCache().findAll()).toHaveLength(0)
    })
  })
})
