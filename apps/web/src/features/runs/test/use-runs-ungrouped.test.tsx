import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { RunSummaryRecord } from '@qably/types'
import { useRunsPage } from '@/features/runs/hooks/use-runs'
import { runKeys } from '@/features/runs/lib/query-keys'
import { listRuns } from '@/features/runs/api/runs.api'

vi.mock('@/features/runs/api/runs.api', () => ({ listRuns: vi.fn() }))

const list = vi.mocked(listRuns)

function runSummary(id: string): RunSummaryRecord {
  return {
    id,
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    suiteName: 'Authentication',
    name: `Run ${id}`,
    status: 'pass',
    source: 'manual',
    externalId: '',
    reportExternalId: '',
    startedAt: '2026-06-16T10:00:00Z',
    caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
    passRate: 1,
    delta: null,
  }
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function cacheHas(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryCache().find({ queryKey }) !== undefined
}

describe('runKeys', () => {
  it('keeps the page key exactly as it was', () => {
    expect(runKeys.page('proj-1', 'all')).toEqual(['runs', 'page', 'proj-1', 'all'])
    expect(runKeys.page('proj-1', 'api')).toEqual(['runs', 'page', 'proj-1', 'api'])
  })

  it('gives the ungrouped list its own page key', () => {
    expect(runKeys.pageUngrouped('proj-1', 'all')).toEqual([
      'runs',
      'page',
      'proj-1',
      'all',
      'ungrouped',
    ])
    expect(runKeys.pageUngrouped('proj-2', 'api')).toEqual([
      'runs',
      'page',
      'proj-2',
      'api',
      'ungrouped',
    ])
  })
})

describe('useRunsPage ungrouped option', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ items: [runSummary('a')] })
  })

  it('requests ungrouped=true under the ungrouped cache key', async () => {
    const client = createClient()

    const { result } = renderHook(() => useRunsPage('proj-1', undefined, { ungrouped: true }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', limit: 25, ungrouped: true }),
      expect.anything(),
    )
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'all'))).toBe(true)
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(false)
  })

  it('keeps the source filter next to the ungrouped one', async () => {
    const client = createClient()

    const { result } = renderHook(() => useRunsPage('proj-1', 'api', { ungrouped: true }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api', ungrouped: true }),
      expect.anything(),
    )
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'api'))).toBe(true)
  })

  it('sends the same params as before for a call with two arguments', async () => {
    const client = createClient()

    const { result } = renderHook(() => useRunsPage('proj-1'), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(list.mock.calls[0][0]).toStrictEqual({
      projectId: 'proj-1',
      source: undefined,
      limit: 25,
      cursor: undefined,
    })
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(true)
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'all'))).toBe(false)
  })

  it('treats ungrouped false as the plain list', async () => {
    const client = createClient()

    const { result } = renderHook(() => useRunsPage('proj-1', 'api', { ungrouped: false }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(list.mock.calls[0][0]).toStrictEqual({
      projectId: 'proj-1',
      source: 'api',
      limit: 25,
      cursor: undefined,
    })
    expect(cacheHas(client, runKeys.page('proj-1', 'api'))).toBe(true)
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'api'))).toBe(false)
  })

  it('never serves the plain list from the ungrouped cache entry', async () => {
    list.mockImplementation((params) =>
      Promise.resolve({
        items: [runSummary(params?.ungrouped === true ? 'manual-only' : 'every-run')],
      }),
    )
    const client = createClient()
    const wrapper = wrapperFor(client)

    const plain = renderHook(() => useRunsPage('proj-1'), { wrapper })
    const ungrouped = renderHook(() => useRunsPage('proj-1', undefined, { ungrouped: true }), {
      wrapper,
    })

    await waitFor(() => expect(plain.result.current.runs).toHaveLength(1))
    await waitFor(() => expect(ungrouped.result.current.runs).toHaveLength(1))
    expect(plain.result.current.runs[0].id).toBe('every-run')
    expect(ungrouped.result.current.runs[0].id).toBe('manual-only')
  })
})
