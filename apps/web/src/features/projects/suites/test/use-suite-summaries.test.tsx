import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import {
  SUITE_SUMMARIES_PAGE_SIZE,
  useSuiteSummaries,
} from '@/features/projects/suites/hooks/use-suite-summaries'
import { listSuiteSummaries } from '@/features/projects/suites/api/suites.api'
import { createTestQueryClient } from '@/lib/query-test-utils'
import {
  NO_FILTERS,
  createQueryClient,
  idsOf,
  pageOf,
  summary,
  wrapperFor,
} from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  listSuiteSummaries: vi.fn(),
  listSuiteTags: vi.fn(),
}))

const list = vi.mocked(listSuiteSummaries)

beforeEach(() => {
  list.mockReset()
})

describe('useSuiteSummaries', () => {
  it('requests the first page with a page size of fifty and no cursor', async () => {
    list.mockResolvedValue(pageOf(['a']))

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(createQueryClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(SUITE_SUMMARIES_PAGE_SIZE).toBe(50)
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith(
      { projectId: 'proj-1', sort: 'recent', limit: 50 },
      expect.any(AbortSignal),
    )
  })

  it('sends the active filters trimmed and leaves the all sentinels out', async () => {
    list.mockResolvedValue(pageOf(['a']))

    const { result, rerender } = renderHook(
      ({ filters }) => useSuiteSummaries('proj-1', filters),
      {
        wrapper: wrapperFor(createQueryClient()),
        initialProps: { filters: NO_FILTERS },
      },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    rerender({ filters: { sort: 'name', search: ' abc ', status: 'fail', tag: 'api' } })

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list.mock.calls[0]?.[0]).toEqual({ projectId: 'proj-1', sort: 'recent', limit: 50 })
    expect(list.mock.calls[1]?.[0]).toEqual({
      projectId: 'proj-1',
      sort: 'name',
      search: 'abc',
      status: 'fail',
      tag: 'api',
      limit: 50,
    })
  })

  it('reports loading and no rows until the first page arrives', async () => {
    list.mockResolvedValue(pageOf(['a', 'b']))

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(createQueryClient()),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.suites).toEqual([])

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(idsOf(result.current.suites)).toEqual(['a', 'b'])
    expect(result.current.hasNextPage).toBe(false)
  })

  it('exposes the rows exactly as the server sent them', async () => {
    const row = summary('a', { name: 'Checkout', status: 'fail', recentPassRate: 90 })
    list.mockResolvedValue({ items: [row], nextCursor: null })

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(createQueryClient()),
    })

    await waitFor(() => expect(result.current.suites).toEqual([row]))
  })

  it('keeps the first appearance of a suite that shows up on two pages', async () => {
    list
      .mockResolvedValueOnce({ items: [summary('a'), summary('b')], nextCursor: 'c1' })
      .mockResolvedValueOnce({
        items: [summary('b', { name: 'Later copy' }), summary('c')],
        nextCursor: null,
      })

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(createQueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a', 'b', 'c']))
    expect(result.current.suites[1]?.name).toBe('Suite b')
  })

  it('reads the seeded default page on the first render, before any request settles', () => {
    list.mockReturnValue(new Promise(() => undefined))

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(createTestQueryClient()),
    })

    expect(idsOf(result.current.suites)).toEqual(['suite-4', 'suite-3', 'suite-2', 'suite-1'])
    expect(result.current.isLoading).toBe(false)
  })

  it('defines no refetch interval on the query it observes', async () => {
    list.mockResolvedValue(pageOf(['a']))
    const client = createQueryClient()

    const { result } = renderHook(() => useSuiteSummaries('proj-1', NO_FILTERS), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const observed = client.getQueryCache().findAll({ queryKey: suiteKeys.summaries('proj-1') })

    expect(observed).toHaveLength(1)
    expect(observed[0]?.observers).toHaveLength(1)
    expect(observed[0]?.observers[0]?.options.refetchInterval).toBeUndefined()
  })
})
