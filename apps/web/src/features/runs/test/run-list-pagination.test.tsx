import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunsPageRecord, RunSummaryRecord } from '@qably/types'
import { RunList } from '@/features/runs/components/run-list'

function renderList(source?: 'manual' | 'api' | 'github_actions') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={client}>
      <RunList projectId="proj-1" source={source} />
    </QueryClientProvider>,
  )
}

const listRuns = vi.fn()

vi.mock('@/features/runs/api/runs.api', () => ({
  listRuns: (...args: unknown[]) => listRuns(...args) as Promise<RunsPageRecord>,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

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
    startedAt: '2026-06-16T10:00:00Z',
    caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
    passRate: 1,
  }
}

describe('RunList pagination', () => {
  beforeEach(() => {
    listRuns.mockReset()
  })

  it('requests a bounded first page rather than every run', async () => {
    listRuns.mockResolvedValue({ items: [runSummary('a')] })

    await act(async () => { renderList() })

    expect(listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', limit: 25, cursor: undefined }),
      expect.anything(),
    )
  })

  it('pushes the source filter into the request instead of filtering a page client-side', async () => {
    listRuns.mockResolvedValue({ items: [runSummary('a')] })

    await act(async () => {
      renderList('github_actions')
    })

    expect(listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'github_actions' }),
      expect.anything(),
    )
  })

  it('appends the next page to the list when load more is used', async () => {
    const user = userEvent.setup()
    listRuns
      .mockResolvedValueOnce({ items: [runSummary('a')], nextCursor: 'a' })
      .mockResolvedValueOnce({ items: [runSummary('b')] })

    await act(async () => { renderList() })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(screen.queryByText('Run b')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /load more/i }))

    expect(await screen.findByText('Run b')).toBeInTheDocument()
    expect(screen.getByText('Run a')).toBeInTheDocument()
    expect(listRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'a' }),
      expect.anything(),
    )
  })

  it('drops the load-more control once the last page arrives', async () => {
    const user = userEvent.setup()
    listRuns
      .mockResolvedValueOnce({ items: [runSummary('a')], nextCursor: 'a' })
      .mockResolvedValueOnce({ items: [runSummary('b')] })

    await act(async () => { renderList() })
    await user.click(await screen.findByRole('button', { name: /load more/i }))
    await screen.findByText('Run b')

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows the empty state when the first page comes back empty', async () => {
    listRuns.mockResolvedValue({ items: [] })

    await act(async () => { renderList() })

    expect(screen.getByText('No runs yet')).toBeInTheDocument()
  })
})
