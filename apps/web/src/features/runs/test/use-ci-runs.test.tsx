import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { CiRunDetailRecord, CiRunSummaryRecord } from '@qably/types'
import { useCiRun, useCiRunsPage } from '@/features/runs/hooks/use-ci-runs'
import { ciRunKeys } from '@/features/runs/lib/query-keys'
import { getCiRun, listCiRuns } from '@/features/runs/api/ci-runs.api'
import { ApiError } from '@/lib/api-client'

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

const list = vi.mocked(listCiRuns)
const detail = vi.mocked(getCiRun)

function ciRun(id: string, overrides: Partial<CiRunSummaryRecord> = {}): CiRunSummaryRecord {
  return {
    id,
    projectId: 'proj-1',
    source: 'github_actions',
    externalId: '900',
    status: 'passing',
    startedAt: '2026-10-03T10:00:00.000Z',
    lastReportedAt: '2026-10-03T10:05:00.000Z',
    ...overrides,
  }
}

function ciRunDetail(id: string): CiRunDetailRecord {
  return {
    ...ciRun(id),
    runs: [
      {
        id: 'run-1',
        suiteId: 'suite-1',
        suiteName: 'Authentication',
        name: 'Authentication',
        status: 'pass',
        startedAt: '2026-10-03T10:00:00.000Z',
        ciJobKey: 'api',
        reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
      },
    ],
  }
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function createSeededClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function cacheHas(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryCache().find({ queryKey }) !== undefined
}

function ids(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id)
}

describe('useCiRunsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requests a bounded first page under the project page key', async () => {
    list.mockResolvedValue({ items: [ciRun('a'), ciRun('b')] })
    const client = createClient()

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b']))
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toStrictEqual({
      projectId: 'proj-1',
      limit: 25,
      cursor: undefined,
    })
    expect(cacheHas(client, ciRunKeys.page('proj-1'))).toBe(true)
  })

  it('hands the abort signal of the query to every page request', async () => {
    list
      .mockResolvedValueOnce({ items: [ciRun('a')], nextCursor: 'after-a' })
      .mockResolvedValueOnce({ items: [ciRun('b')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a']))

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b']))

    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenNthCalledWith(1, expect.anything(), expect.any(AbortSignal))
    expect(list).toHaveBeenNthCalledWith(2, expect.anything(), expect.any(AbortSignal))
  })

  it('reports loading until the first page arrives', async () => {
    let resolvePage: (page: { items: CiRunSummaryRecord[] }) => void = () => undefined
    list.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve
      }),
    )

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.ciRuns).toEqual([])

    await act(async () => {
      resolvePage({ items: [ciRun('a')] })
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(ids(result.current.ciRuns)).toEqual(['a'])
  })

  it('has no next page when the response carries no cursor', async () => {
    list.mockResolvedValue({ items: [ciRun('a')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => expect(result.current.ciRuns).toHaveLength(1))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('accumulates pages and hands each cursor back unchanged', async () => {
    list
      .mockResolvedValueOnce({ items: [ciRun('a'), ciRun('b')], nextCursor: 'after-b' })
      .mockResolvedValueOnce({ items: [ciRun('c'), ciRun('d')], nextCursor: 'after-d' })
      .mockResolvedValueOnce({ items: [ciRun('e')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b']))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b', 'c', 'd']))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b', 'c', 'd', 'e']))
    expect(result.current.hasNextPage).toBe(false)
    expect(list.mock.calls.map(([params]) => params.cursor)).toEqual([undefined, 'after-b', 'after-d'])
    expect(list.mock.calls.every(([params]) => params.limit === 25)).toBe(true)
  })

  it('marks the next page as fetching while it is in flight', async () => {
    let resolvePage: (page: { items: CiRunSummaryRecord[] }) => void = () => undefined
    list.mockResolvedValueOnce({ items: [ciRun('a')], nextCursor: 'a' }).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve
      }),
    )

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })
    await waitFor(() => expect(result.current.ciRuns).toHaveLength(1))
    expect(result.current.isFetchingNextPage).toBe(false)

    act(() => {
      void result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true))
    expect(ids(result.current.ciRuns)).toEqual(['a'])

    await act(async () => {
      resolvePage({ items: [ciRun('b')] })
    })
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false))
    expect(ids(result.current.ciRuns)).toEqual(['a', 'b'])
  })

  it('keeps the loaded rows and the way to retry when the next page fails', async () => {
    list
      .mockResolvedValueOnce({ items: [ciRun('a'), ciRun('b')], nextCursor: 'after-b' })
      .mockRejectedValueOnce(new ApiError(500, 'Internal error'))
      .mockResolvedValueOnce({ items: [ciRun('c')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b']))

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(ids(result.current.ciRuns)).toEqual(['a', 'b'])
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(ids(result.current.ciRuns)).toEqual(['a', 'b', 'c']))
    expect(result.current.isError).toBe(false)
    expect(list.mock.calls.map(([params]) => params.cursor)).toEqual([
      undefined,
      'after-b',
      'after-b',
    ])
  })

  it('reports an error with no rows when the first page fails', async () => {
    list.mockRejectedValue(new ApiError(500, 'Internal error'))

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.ciRuns).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('keeps each project in its own cache entry', async () => {
    list.mockImplementation((params) =>
      Promise.resolve({ items: [ciRun(`${params.projectId}-run`, { projectId: params.projectId })] }),
    )
    const client = createClient()
    const wrapper = wrapperFor(client)

    const first = renderHook(() => useCiRunsPage('proj-1'), { wrapper })
    const second = renderHook(() => useCiRunsPage('proj-2'), { wrapper })

    await waitFor(() => expect(first.result.current.ciRuns).toHaveLength(1))
    await waitFor(() => expect(second.result.current.ciRuns).toHaveLength(1))
    expect(ids(first.result.current.ciRuns)).toEqual(['proj-1-run'])
    expect(ids(second.result.current.ciRuns)).toEqual(['proj-2-run'])
    expect(cacheHas(client, ciRunKeys.page('proj-1'))).toBe(true)
    expect(cacheHas(client, ciRunKeys.page('proj-2'))).toBe(true)
  })

  it('serves rows seeded under the page key without asking the server', async () => {
    const client = createSeededClient()
    client.setQueryData(ciRunKeys.page('proj-1'), {
      pages: [{ items: [ciRun('seeded-a'), ciRun('seeded-b')], nextCursor: 'seeded-b' }],
      pageParams: [undefined],
    })
    list.mockResolvedValue({ items: [ciRun('from-server')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(client),
    })

    expect(ids(result.current.ciRuns)).toEqual(['seeded-a', 'seeded-b'])
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(list).not.toHaveBeenCalled()
  })

  it('does not refetch the page on a timer', async () => {
    vi.useFakeTimers()
    list.mockReset()
    list.mockResolvedValue({ items: [ciRun('a')] })

    const { result } = renderHook(() => useCiRunsPage('proj-1'), {
      wrapper: wrapperFor(createClient()),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(result.current.ciRuns).toHaveLength(1)
    expect(list).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })

    expect(list).toHaveBeenCalledTimes(1)
  })
})

describe('useCiRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the CI run under its detail key', async () => {
    detail.mockResolvedValue(ciRunDetail('c1'))
    const client = createClient()

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(client) })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.ciRun?.id).toBe('c1'))
    expect(result.current.ciRun?.runs).toHaveLength(1)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(detail).toHaveBeenCalledTimes(1)
    expect(detail.mock.calls[0][0]).toBe('c1')
    expect(cacheHas(client, ciRunKeys.detail('c1'))).toBe(true)
  })

  it('hands the abort signal of the query to the request', async () => {
    detail.mockResolvedValue(ciRunDetail('c1'))

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(createClient()) })
    await waitFor(() => expect(result.current.ciRun?.id).toBe('c1'))

    expect(detail).toHaveBeenCalledTimes(1)
    expect(detail).toHaveBeenCalledWith('c1', expect.any(AbortSignal))
  })

  it('makes no request while the id is undefined', async () => {
    detail.mockResolvedValue(ciRunDetail('c1'))
    const client = createClient()

    const { result } = renderHook(() => useCiRun(undefined), { wrapper: wrapperFor(client) })

    await act(async () => {
      await Promise.resolve()
    })

    expect(detail).not.toHaveBeenCalled()
    expect(result.current.ciRun).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)

    const queries = client.getQueryCache().getAll()
    expect(queries).toHaveLength(1)
    for (const query of queries) {
      expect(query.queryKey.every((part) => typeof part === 'string' && part !== 'undefined')).toBe(
        true,
      )
    }
  })

  it('makes no request for an empty id either', async () => {
    detail.mockResolvedValue(ciRunDetail('c1'))

    const { result } = renderHook(() => useCiRun(''), { wrapper: wrapperFor(createClient()) })

    await act(async () => {
      await Promise.resolve()
    })

    expect(detail).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('starts requesting once the id arrives', async () => {
    detail.mockResolvedValue(ciRunDetail('c1'))
    const client = createClient()

    const { result, rerender } = renderHook(({ id }) => useCiRun(id), {
      wrapper: wrapperFor(client),
      initialProps: { id: undefined as string | undefined },
    })
    expect(detail).not.toHaveBeenCalled()

    rerender({ id: 'c1' })

    await waitFor(() => expect(result.current.ciRun?.id).toBe('c1'))
    expect(detail).toHaveBeenCalledTimes(1)
  })

  it('keeps two ids in separate cache entries', async () => {
    detail.mockImplementation((id) => Promise.resolve(ciRunDetail(id)))
    const client = createClient()
    const wrapper = wrapperFor(client)

    const first = renderHook(() => useCiRun('c1'), { wrapper })
    const second = renderHook(() => useCiRun('c2'), { wrapper })

    await waitFor(() => expect(first.result.current.ciRun?.id).toBe('c1'))
    await waitFor(() => expect(second.result.current.ciRun?.id).toBe('c2'))
    expect(cacheHas(client, ciRunKeys.detail('c1'))).toBe(true)
    expect(cacheHas(client, ciRunKeys.detail('c2'))).toBe(true)
  })

  it('exposes a 404 so the caller can tell not found from a failure', async () => {
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    const { result } = renderHook(() => useCiRun('missing'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.ciRun).toBeUndefined()
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect((result.current.error as ApiError).status).toBe(404)
    expect((result.current.error as ApiError).code).toBe('not-found')
  })

  it('exposes a server failure with its own status', async () => {
    vi.useFakeTimers()
    detail.mockRejectedValue(new ApiError(500, 'Internal error'))

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(createClient()) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.isError).toBe(true)
    expect((result.current.error as ApiError).status).toBe(500)
  })

  it('does not retry a request that came back 404', async () => {
    vi.useFakeTimers()
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

    const { result } = renderHook(() => useCiRun('missing'), { wrapper: wrapperFor(client) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.isError).toBe(true)
    expect(detail).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(detail).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a server failure', new ApiError(500, 'Internal error')],
    ['a forbidden response', new ApiError(403, 'Forbidden', 'forbidden')],
    ['a network failure', new TypeError('Failed to fetch')],
  ])('retries %s once before reporting it', async (_label, failure) => {
    vi.useFakeTimers()
    detail.mockRejectedValue(failure)

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(createClient()) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(detail).toHaveBeenCalledTimes(1)
    expect(result.current.isError).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(detail).toHaveBeenCalledTimes(2)
    expect(result.current.isError).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(detail).toHaveBeenCalledTimes(2)
  })

  it('serves a CI run seeded under the detail key without asking the server', () => {
    const client = createSeededClient()
    client.setQueryData(ciRunKeys.detail('c1'), ciRunDetail('c1'))
    detail.mockResolvedValue({ ...ciRunDetail('c1'), id: 'from-server' })

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(client) })

    expect(result.current.ciRun?.id).toBe('c1')
    expect(result.current.isLoading).toBe(false)
    expect(detail).not.toHaveBeenCalled()
  })

  it('does not refetch the detail on a timer', async () => {
    vi.useFakeTimers()
    detail.mockReset()
    detail.mockResolvedValue(ciRunDetail('c1'))

    const { result } = renderHook(() => useCiRun('c1'), { wrapper: wrapperFor(createClient()) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(result.current.ciRun?.id).toBe('c1')
    expect(detail).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })

    expect(detail).toHaveBeenCalledTimes(1)
  })
})
