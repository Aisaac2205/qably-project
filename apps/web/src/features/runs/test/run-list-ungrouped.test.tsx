import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunSource, RunSummaryRecord } from '@qably/types'
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

function renderLists(client: QueryClient, props: { ungrouped?: boolean; source?: RunSource }[]) {
  return render(
    <QueryClientProvider client={client}>
      {props.map((entry, index) => (
        <RunList key={index} projectId="proj-1" {...entry} />
      ))}
    </QueryClientProvider>,
  )
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

describe('RunList ungrouped', () => {
  beforeEach(() => {
    listRuns.mockReset()
    listRuns.mockResolvedValue({ items: [runSummary('a')] })
  })

  it('asks for the runs without a CI run and caches them under their own key', async () => {
    const client = createClient()

    await act(async () => {
      renderLists(client, [{ ungrouped: true }])
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', limit: 25, ungrouped: true }),
      expect.anything(),
    )
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'all'))).toBe(true)
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(false)
  })

  it('keeps the source filter when ungrouped is on', async () => {
    await act(async () => {
      renderLists(createClient(), [{ ungrouped: true, source: 'api' }])
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api', ungrouped: true }),
      expect.anything(),
    )
  })

  it('sends no ungrouped param when the prop is absent', async () => {
    const client = createClient()

    await act(async () => {
      renderLists(client, [{}])
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(listRuns.mock.calls[0][0]).not.toHaveProperty('ungrouped')
    expect(cacheHas(client, runKeys.page('proj-1', 'all'))).toBe(true)
    expect(cacheHas(client, runKeys.pageUngrouped('proj-1', 'all'))).toBe(false)
  })

  it('shows each list its own runs when both are mounted on one cache', async () => {
    listRuns.mockImplementation((params: { ungrouped?: boolean }) =>
      Promise.resolve({
        items: [runSummary(params.ungrouped === true ? 'manual-only' : 'every-run')],
      }),
    )

    await act(async () => {
      renderLists(createClient(), [{}, { ungrouped: true }])
    })

    expect(await screen.findByText('Run every-run')).toBeInTheDocument()
    expect(await screen.findByText('Run manual-only')).toBeInTheDocument()
    expect(listRuns).toHaveBeenCalledTimes(2)
  })
})
