import { describe, expect, it, vi } from 'vitest'
import { QueryObserver } from '@tanstack/react-query'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import {
  invalidateSuiteSummaries,
  markSuiteSummariesStale,
  removeFromSuiteSummaries,
  type SuiteSummariesData,
} from '@/features/projects/suites/lib/suite-summaries-cache'
import { summary } from './suite-summaries-test-data'
import {
  LOOKALIKE_PROJECT,
  OTHER_PROJECT,
  RECENT,
  SEARCH,
  dataOf,
  idsIn,
  itemsOf,
  seededClient,
} from './suite-summaries-cache-test-data'

describe('removeFromSuiteSummaries', () => {
  it('removes the suite from every page of every filter variant of its project', () => {
    const client = seededClient()

    removeFromSuiteSummaries(client, 'proj-1', 'c')

    expect(idsIn(client, RECENT)).toEqual(['a', 'b', 'd'])
    expect(idsIn(client, SEARCH)).toEqual(['e'])
  })

  it('keeps the pages, their cursors and the page params as they were', () => {
    const client = seededClient()

    removeFromSuiteSummaries(client, 'proj-1', 'c')

    const after = client.getQueryData<SuiteSummariesData>(RECENT)
    expect(after?.pageParams).toEqual([undefined, 'cursor-1'])
    expect(after?.pages.map((page) => page.nextCursor)).toEqual(['cursor-1', null])
    expect(after?.pages.map((page) => page.items.length)).toEqual([2, 1])
  })

  it('leaves the other rows exactly as they were', () => {
    const client = seededClient()
    const before = itemsOf(client, RECENT).filter((item) => item.id !== 'c')

    removeFromSuiteSummaries(client, 'proj-1', 'c')

    expect(itemsOf(client, RECENT)).toEqual(before)
  })

  it('leaves another project alone, even one that holds a suite with the same id', () => {
    const client = seededClient()

    removeFromSuiteSummaries(client, 'proj-1', 'c')

    expect(idsIn(client, LOOKALIKE_PROJECT)).toEqual(['c'])
    expect(idsIn(client, OTHER_PROJECT)).toEqual(['z', 'y'])
  })

  it('changes no cached value when the suite is not loaded', () => {
    const client = seededClient()
    const before = client.getQueryData(RECENT)

    removeFromSuiteSummaries(client, 'proj-1', 'unknown')

    expect(client.getQueryData(RECENT)).toBe(before)
  })

  it('empties a page that held only that suite and keeps its cursor', () => {
    const client = seededClient()
    client.setQueryData(RECENT, dataOf([summary('a')], [summary('c')]))

    removeFromSuiteSummaries(client, 'proj-1', 'c')

    const after = client.getQueryData<SuiteSummariesData>(RECENT)
    expect(after?.pages.map((page) => page.items.map((item) => item.id))).toEqual([['a'], []])
    expect(after?.pages.map((page) => page.nextCursor)).toEqual(['cursor-1', null])
  })
})

describe('invalidateSuiteSummaries', () => {
  it('marks every summary variant and the facet of the project stale', async () => {
    const client = seededClient()

    await invalidateSuiteSummaries(client, 'proj-1')

    expect(client.getQueryState(RECENT)?.isInvalidated).toBe(true)
    expect(client.getQueryState(SEARCH)?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.tags('proj-1'))?.isInvalidated).toBe(true)
  })

  it('leaves other projects, the plain list and the detail alone', async () => {
    const client = seededClient()

    await invalidateSuiteSummaries(client, 'proj-1')

    expect(client.getQueryState(OTHER_PROJECT)?.isInvalidated).toBe(false)
    expect(client.getQueryState(LOOKALIKE_PROJECT)?.isInvalidated).toBe(false)
    expect(client.getQueryState(suiteKeys.tags('proj-2'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(suiteKeys.detail('c'))?.isInvalidated).toBe(false)
  })

  it('refetches the summaries and the facet that someone is looking at', async () => {
    const client = seededClient()
    const summariesFn = vi.fn().mockResolvedValue(dataOf([summary('a')]))
    const tagsFn = vi.fn().mockResolvedValue({ items: ['old'] })
    const summaries = new QueryObserver(client, { queryKey: RECENT, queryFn: summariesFn })
    const tags = new QueryObserver(client, {
      queryKey: suiteKeys.tags('proj-1'),
      queryFn: tagsFn,
    })
    const stopSummaries = summaries.subscribe(() => undefined)
    const stopTags = tags.subscribe(() => undefined)

    await invalidateSuiteSummaries(client, 'proj-1')
    stopSummaries()
    stopTags()

    expect(summariesFn).toHaveBeenCalledTimes(1)
    expect(tagsFn).toHaveBeenCalledTimes(1)
  })
})

describe('markSuiteSummariesStale', () => {
  it('marks every summary variant of the project stale', () => {
    const client = seededClient()

    markSuiteSummariesStale(client, 'proj-1')

    expect(client.getQueryState(RECENT)?.isInvalidated).toBe(true)
    expect(client.getQueryState(SEARCH)?.isInvalidated).toBe(true)
  })

  it('leaves the facet, other projects and the plain list alone', () => {
    const client = seededClient()

    markSuiteSummariesStale(client, 'proj-1')

    expect(client.getQueryState(suiteKeys.tags('proj-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(OTHER_PROJECT)?.isInvalidated).toBe(false)
    expect(client.getQueryState(LOOKALIKE_PROJECT)?.isInvalidated).toBe(false)
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(false)
  })

  it('never fetches, even for a variant that still has an observer', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue(dataOf([summary('a')]))
    const observer = new QueryObserver(client, { queryKey: RECENT, queryFn })
    const unsubscribe = observer.subscribe(() => undefined)

    markSuiteSummariesStale(client, 'proj-1')
    await client.isFetching()
    unsubscribe()

    expect(queryFn).not.toHaveBeenCalled()
  })

  it('makes the next visit to the list refetch it even inside the stale time', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue(dataOf([summary('a')]))

    markSuiteSummariesStale(client, 'proj-1')
    const observer = new QueryObserver(client, { queryKey: RECENT, queryFn })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })
})
