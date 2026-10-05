import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunSummaryRecord } from '@qably/types'
import { RunList } from '@/features/runs/components/run-list'
import { runKeys } from '@/features/runs/lib/query-keys'

const listRuns = vi.fn()

vi.mock('@/features/runs/api/runs.api', () => ({
  listRuns: (...args: unknown[]) => listRuns(...args) as Promise<unknown>,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
}

function cacheHas(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryCache().find({ queryKey }) !== undefined
}

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

describe('RunList source', () => {
  beforeEach(() => {
    listRuns.mockReset()
    listRuns.mockResolvedValue({ items: [runSummary('a')] })
  })

  it('asks the api for manual runs only', async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={createClient()}>
          <RunList projectId="proj-1" />
        </QueryClientProvider>,
      )
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(listRuns).toHaveBeenCalledTimes(1)
    expect(listRuns).toHaveBeenCalledWith(
      { projectId: 'proj-1', source: 'manual', limit: 25, cursor: undefined },
      expect.anything(),
    )
    expect(listRuns.mock.calls[0][0]).not.toHaveProperty('ungrouped')
  })

  it('caches the manual runs under the page key of the manual source', async () => {
    const client = createClient()

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <RunList projectId="proj-1" />
        </QueryClientProvider>,
      )
    })
    await screen.findByText('Run a')

    expect(cacheHas(client, runKeys.page('proj-1', 'manual'))).toBe(true)
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(false)
  })
})
