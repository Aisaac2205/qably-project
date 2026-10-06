import { act, renderHook, waitFor } from '@testing-library/react'
import type { InfiniteData } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { useSuiteSummaries } from '@/features/projects/suites/hooks/use-suite-summaries'
import { listSuiteSummaries } from '@/features/projects/suites/api/suites.api'
import type { SuiteSummariesFilters } from '@/features/projects/suites/lib/suite-summaries-query'
import {
  NO_FILTERS,
  createQueryClient,
  deferred,
  idsOf,
  pageOf,
  wrapperFor,
} from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  listSuiteSummaries: vi.fn(),
  listSuiteTags: vi.fn(),
}))

const list = vi.mocked(listSuiteSummaries)

interface HookProps {
  projectId: string
  filters: SuiteSummariesFilters
}

const INITIAL: HookProps = { projectId: 'proj-1', filters: NO_FILTERS }

function renderSummaries() {
  const client = createQueryClient()
  const rendered = renderHook(
    ({ projectId, filters }: HookProps) => useSuiteSummaries(projectId, filters),
    { wrapper: wrapperFor(client), initialProps: INITIAL },
  )

  return { ...rendered, client }
}

type Rendered = ReturnType<typeof renderSummaries>

async function loadNextPage(result: Rendered['result'], expectedIds: string[]) {
  await waitFor(() => expect(result.current.hasNextPage).toBe(true))
  await act(async () => {
    await result.current.fetchNextPage()
  })
  await waitFor(() => expect(idsOf(result.current.suites)).toEqual(expectedIds))
}

beforeEach(() => {
  list.mockReset()
})

describe('useSuiteSummaries pagination', () => {
  it('offers more only while the last page carries a cursor and appends the next page', async () => {
    list.mockResolvedValueOnce(pageOf(['a'], 'cur-1')).mockResolvedValueOnce(pageOf(['b'], null))
    const { result } = renderSummaries()

    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    expect(idsOf(result.current.suites)).toEqual(['a'])

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a', 'b']))
    expect(list).toHaveBeenLastCalledWith(
      { projectId: 'proj-1', sort: 'recent', cursor: 'cur-1', limit: 50 },
      expect.any(AbortSignal),
    )
    expect(result.current.hasNextPage).toBe(false)
  })

  it('reports the next page as fetching while it is in flight and keeps the rows in view', async () => {
    const next = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['a'], 'cur-1')).mockReturnValueOnce(next.promise)
    const { result } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    act(() => {
      void result.current.fetchNextPage()
    })

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true))
    expect(idsOf(result.current.suites)).toEqual(['a'])

    await act(async () => {
      next.resolve(pageOf(['b']))
    })

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false))
    expect(idsOf(result.current.suites)).toEqual(['a', 'b'])
  })

  it('refetches every loaded page one after the other, starting with the first, and keeps the rows in view', async () => {
    list
      .mockResolvedValueOnce(pageOf(['old-1'], 'cur-1'))
      .mockResolvedValueOnce(pageOf(['old-2'], 'cur-2'))
      .mockResolvedValueOnce(pageOf(['old-3'], null))
    const { result, client } = renderSummaries()
    await loadNextPage(result, ['old-1', 'old-2'])
    await loadNextPage(result, ['old-1', 'old-2', 'old-3'])
    list.mockClear()

    const first = deferred<SuiteSummariesPage>()
    const second = deferred<SuiteSummariesPage>()
    const third = deferred<SuiteSummariesPage>()
    list
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)

    act(() => {
      void client.invalidateQueries({ queryKey: suiteKeys.summaries('proj-1') })
    })

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    expect(list.mock.calls[0]?.[0].cursor).toBeUndefined()
    expect(idsOf(result.current.suites)).toEqual(['old-1', 'old-2', 'old-3'])
    expect(result.current.isPlaceholderData).toBe(false)

    await act(async () => {
      first.resolve(pageOf(['new-1'], 'next-1'))
    })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list.mock.calls[1]?.[0].cursor).toBe('next-1')
    expect(idsOf(result.current.suites)).toEqual(['old-1', 'old-2', 'old-3'])

    await act(async () => {
      second.resolve(pageOf(['new-2'], 'next-2'))
    })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
    expect(list.mock.calls[2]?.[0].cursor).toBe('next-2')

    await act(async () => {
      third.resolve(pageOf(['new-3'], null))
    })
    await waitFor(() =>
      expect(idsOf(result.current.suites)).toEqual(['new-1', 'new-2', 'new-3']),
    )
  })

  it.each<{
    label: string
    next: HookProps
    rowsWhileLoading: string[]
    isPlaceholder: boolean
  }>([
    {
      label: 'search',
      next: { projectId: 'proj-1', filters: { ...NO_FILTERS, search: 'login' } },
      rowsWhileLoading: ['a', 'b'],
      isPlaceholder: true,
    },
    {
      label: 'status',
      next: { projectId: 'proj-1', filters: { ...NO_FILTERS, status: 'fail' } },
      rowsWhileLoading: ['a', 'b'],
      isPlaceholder: true,
    },
    {
      label: 'tag',
      next: { projectId: 'proj-1', filters: { ...NO_FILTERS, tag: 'api' } },
      rowsWhileLoading: ['a', 'b'],
      isPlaceholder: true,
    },
    {
      label: 'sort',
      next: { projectId: 'proj-1', filters: { ...NO_FILTERS, sort: 'name' } },
      rowsWhileLoading: ['a', 'b'],
      isPlaceholder: true,
    },
    {
      label: 'project',
      next: { projectId: 'proj-2', filters: NO_FILTERS },
      rowsWhileLoading: [],
      isPlaceholder: false,
    },
  ])(
    'starts again from the first page when the $label changes, with $rowsWhileLoading in view while it loads',
    async ({ next, rowsWhileLoading, isPlaceholder }) => {
      const fresh = deferred<SuiteSummariesPage>()
      list
        .mockResolvedValueOnce(pageOf(['a'], 'cur-1'))
        .mockResolvedValueOnce(pageOf(['b'], 'cur-2'))
        .mockReturnValueOnce(fresh.promise)
      const { result, rerender } = renderSummaries()
      await loadNextPage(result, ['a', 'b'])

      rerender(next)

      await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
      expect(idsOf(result.current.suites)).toEqual(rowsWhileLoading)
      expect(result.current.isPlaceholderData).toBe(isPlaceholder)
      expect(result.current.hasNextPage).toBe(false)

      await act(async () => {
        fresh.resolve(pageOf(['fresh'], null))
      })

      await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['fresh']))
      const request = list.mock.calls[2]?.[0]
      expect(request).toMatchObject({ projectId: next.projectId, sort: next.filters.sort })
      expect(request?.cursor).toBeUndefined()
      expect(result.current.isPlaceholderData).toBe(false)
      expect(result.current.hasNextPage).toBe(false)
    },
  )

  it('drops the answer of a next page that was still in flight when a filter changed', async () => {
    const lateNextPage = deferred<SuiteSummariesPage>()
    list
      .mockResolvedValueOnce(pageOf(['a'], 'cur-1'))
      .mockReturnValueOnce(lateNextPage.promise)
      .mockResolvedValueOnce(pageOf(['fresh'], null))
    const { result, rerender, client } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    act(() => {
      void result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true))

    rerender({ projectId: 'proj-1', filters: { ...NO_FILTERS, status: 'fail' } })
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['fresh']))

    await act(async () => {
      lateNextPage.resolve(pageOf(['stale'], null))
    })

    expect(idsOf(result.current.suites)).toEqual(['fresh'])
    const abandoned = client.getQueryData<InfiniteData<SuiteSummariesPage, string | undefined>>(
      suiteKeys.summaryPage('proj-1', { sort: 'recent' }),
    )
    expect(abandoned?.pages).toHaveLength(1)
    expect(idsOf(abandoned?.pages[0]?.items ?? [])).toEqual(['a'])
  })

  it('shows the answer of the latest search even when an older one answers after it', async () => {
    const olderSearch = deferred<SuiteSummariesPage>()
    const latestSearch = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['all'], null))
    const { result, rerender } = renderSummaries()
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['all']))
    list.mockReturnValueOnce(olderSearch.promise).mockReturnValueOnce(latestSearch.promise)

    rerender({ projectId: 'proj-1', filters: { ...NO_FILTERS, search: 'ab' } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    rerender({ projectId: 'proj-1', filters: { ...NO_FILTERS, search: 'abc' } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))

    await act(async () => {
      latestSearch.resolve(pageOf(['abc-row'], null))
    })
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['abc-row']))
    await act(async () => {
      olderSearch.resolve(pageOf(['ab-row'], null))
    })

    expect(idsOf(result.current.suites)).toEqual(['abc-row'])
  })
})
