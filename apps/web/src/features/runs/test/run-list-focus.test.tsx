import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunSummaryRecord } from '@qably/types'
import { RunList } from '@/features/runs/components/run-list'
import { expectEveryFocusableToCarryARing, expectFocusRing } from './focus-ring'

const listRuns = vi.fn()

vi.mock('@/features/runs/api/runs.api', () => ({
  listRuns: (...args: unknown[]) => listRuns(...args) as Promise<unknown>,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

async function renderList({ ungrouped = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  const view = render(
    <QueryClientProvider client={client}>
      <RunList projectId="proj-1" ungrouped={ungrouped} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(listRuns).toHaveBeenCalledTimes(1))

  return view
}

async function renderPage() {
  listRuns.mockResolvedValue(mixedPage())
  const view = await renderList()
  await screen.findByText('Run manual-1')

  return view
}

function runSummary(id: string, overrides: Partial<RunSummaryRecord> = {}): RunSummaryRecord {
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
    ...overrides,
  }
}

function mixedPage() {
  return {
    items: [
      runSummary('manual-1'),
      runSummary('ci-1', { source: 'github_actions', status: 'fail', commitSha: 'b1e4d90aaaa' }),
      runSummary('api-1', { source: 'api' }),
    ],
    nextCursor: 'api-1',
  }
}

describe('RunList focus', () => {
  beforeEach(() => {
    listRuns.mockReset()
  })

  it('gives every row an inset ring so the clipped edge of the list cannot hide it', async () => {
    await renderPage()

    const rows = screen.getAllByRole('link')

    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expectFocusRing(row, { inset: true })
      expect(row).not.toHaveClass('focus-visible:ring-offset-2')
    }
  })

  it('gives the source icons an offset ring, since they sit inside the padding of the row', async () => {
    await renderPage()

    const icons = [screen.getByLabelText('CI'), screen.getByLabelText('Manual')]

    for (const icon of icons) {
      expectFocusRing(icon)
      expect(icon).toHaveClass('focus-visible:ring-offset-2')
      expect(icon).not.toHaveClass('focus-visible:ring-inset')
    }
  })

  it('makes the load more control show a full-strength ring instead of the faint primitive one', async () => {
    await renderPage()

    expectFocusRing(screen.getByRole('button', { name: /load more/i }))
  })

  it('carries a ring on every focusable element of a full page', async () => {
    const { container } = await renderPage()

    expectEveryFocusableToCarryARing(container, 6)
  })

  it('carries a ring on both links of the default empty state, away from any clipped edge', async () => {
    listRuns.mockResolvedValue({ items: [] })
    const { container } = await renderList({ ungrouped: false })

    const links = screen.getAllByRole('link')

    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveClass('focus-visible:ring-offset-2')
      expect(link).not.toHaveClass('focus-visible:ring-inset')
    }
    expectEveryFocusableToCarryARing(container, 2)
  })

  it('carries a ring on the start link of the Manual empty state, away from any clipped edge', async () => {
    listRuns.mockResolvedValue({ items: [] })
    const { container } = await renderList()

    const links = screen.getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveClass('focus-visible:ring-offset-2')
    expect(links[0]).not.toHaveClass('focus-visible:ring-inset')
    expectEveryFocusableToCarryARing(container, 1)
  })
})

describe('RunList touch targets', () => {
  beforeEach(() => {
    listRuns.mockReset()
  })

  it('gives the load more button the 44px target below md and 40px from md up, like the CI list', async () => {
    await renderPage()

    const button = screen.getByRole('button', { name: /load more/i })

    expect(button).toHaveClass('h-11', 'md:h-10')
    expect(button).not.toHaveClass('h-10')
  })
})
