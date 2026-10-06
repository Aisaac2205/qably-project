import { act, renderHook, waitFor } from '@testing-library/react'
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
const SEARCHING: HookProps = { projectId: 'proj-1', filters: { ...NO_FILTERS, search: 'x' } }

function renderSummaries() {
  const client = createQueryClient()
  const rendered = renderHook(
    ({ projectId, filters }: HookProps) => useSuiteSummaries(projectId, filters),
    { wrapper: wrapperFor(client), initialProps: INITIAL },
  )

  return { ...rendered, client }
}

beforeEach(() => {
  list.mockReset()
})

describe('useSuiteSummaries placeholder', () => {
  it('keeps the previous rows in view, marked as placeholder, while a filter of the same project loads', async () => {
    const searched = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['a', 'b'], 'cur-1')).mockReturnValueOnce(searched.promise)
    const { result, rerender } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    rerender(SEARCHING)

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true))
    expect(idsOf(result.current.suites)).toEqual(['a', 'b'])
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      searched.resolve(pageOf(['x1']))
    })

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))
    expect(idsOf(result.current.suites)).toEqual(['x1'])
  })

  it('hides the load more offer while the rows are a placeholder', async () => {
    const searched = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['a'], 'cur-1')).mockReturnValueOnce(searched.promise)
    const { result, rerender } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    rerender(SEARCHING)

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('does not lend the rows of one project to another', async () => {
    const other = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['a'], null)).mockReturnValueOnce(other.promise)
    const { result, rerender } = renderSummaries()
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a']))

    rerender({ projectId: 'proj-2', filters: NO_FILTERS })

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(result.current.suites).toEqual([])
    expect(result.current.isPlaceholderData).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('reports a failed load of the new query as a loading error with no rows', async () => {
    const searched = deferred<SuiteSummariesPage>()
    list.mockResolvedValueOnce(pageOf(['a'], null)).mockReturnValueOnce(searched.promise)
    const { result, rerender } = renderSummaries()
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a']))
    rerender(SEARCHING)
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true))

    await act(async () => {
      searched.reject(new Error('boom'))
    })

    await waitFor(() => expect(result.current.isLoadingError).toBe(true))
    expect(result.current.suites).toEqual([])
    expect(result.current.isPlaceholderData).toBe(false)
  })

  it('loads again from the failed query when refetch is called', async () => {
    list.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(pageOf(['a']))
    const { result } = renderSummaries()
    await waitFor(() => expect(result.current.isLoadingError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a']))
    expect(result.current.isLoadingError).toBe(false)
  })
})

describe('useSuiteSummaries failures with rows on screen', () => {
  it('keeps the loaded rows and offers a retry when the next page fails', async () => {
    list.mockResolvedValueOnce(pageOf(['a'], 'cur-1')).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true))
    expect(result.current.isLoadingError).toBe(false)
    expect(idsOf(result.current.suites)).toEqual(['a'])
    expect(result.current.hasNextPage).toBe(true)
  })

  it('retries the same page with the same cursor', async () => {
    list
      .mockResolvedValueOnce(pageOf(['a'], 'cur-1'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(pageOf(['b']))
    const { result } = renderSummaries()
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true))

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a', 'b']))
    expect(list.mock.calls[1]?.[0].cursor).toBe('cur-1')
    expect(list.mock.calls[2]?.[0].cursor).toBe('cur-1')
    expect(result.current.isFetchNextPageError).toBe(false)
  })

  it('keeps the rows without a blocking error when a background refetch fails', async () => {
    list.mockResolvedValueOnce(pageOf(['a'], null)).mockRejectedValueOnce(new Error('boom'))
    const { result, client } = renderSummaries()
    await waitFor(() => expect(idsOf(result.current.suites)).toEqual(['a']))

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() =>
      expect(client.getQueryState(suiteKeys.summaryPage('proj-1', { sort: 'recent' }))?.status).toBe(
        'error',
      ),
    )
    expect(list).toHaveBeenCalledTimes(2)
    expect(idsOf(result.current.suites)).toEqual(['a'])
    expect(result.current.isLoadingError).toBe(false)
    expect(result.current.isFetchNextPageError).toBe(false)
  })
})
