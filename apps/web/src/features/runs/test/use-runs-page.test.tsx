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

describe('runKeys.page', () => {
  it('keeps one page key per project and source', () => {
    expect(runKeys.page('proj-1', 'all')).toEqual(['runs', 'page', 'proj-1', 'all'])
    expect(runKeys.page('proj-1', 'manual')).toEqual(['runs', 'page', 'proj-1', 'manual'])
  })

  it('has no separate key for a list narrowed by the CI run link', () => {
    expect(runKeys).not.toHaveProperty('pageUngrouped')
  })
})

describe('useRunsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ items: [runSummary('a')] })
  })

  it('requests the source it is given under that source key', async () => {
    const client = createClient()

    const { result } = renderHook(() => useRunsPage('proj-1', 'manual'), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(list.mock.calls[0][0]).toStrictEqual({
      projectId: 'proj-1',
      source: 'manual',
      limit: 25,
      cursor: undefined,
    })
    expect(cacheHas(client, runKeys.page('proj-1', 'manual'))).toBe(true)
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(false)
  })

  it('asks for every source when none is given', async () => {
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
  })

  it('never serves one source from the cache entry of another', async () => {
    list.mockImplementation((params) =>
      Promise.resolve({
        items: [runSummary(params?.source === 'manual' ? 'manual-only' : 'every-run')],
      }),
    )
    const client = createClient()
    const wrapper = wrapperFor(client)

    const everything = renderHook(() => useRunsPage('proj-1'), { wrapper })
    const manual = renderHook(() => useRunsPage('proj-1', 'manual'), { wrapper })

    await waitFor(() => expect(everything.result.current.runs).toHaveLength(1))
    await waitFor(() => expect(manual.result.current.runs).toHaveLength(1))
    expect(everything.result.current.runs[0].id).toBe('every-run')
    expect(manual.result.current.runs[0].id).toBe('manual-only')
  })
})
