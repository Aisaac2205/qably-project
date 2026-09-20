import { render, screen, act, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunsPageRecord, RunSummaryRecord } from '@qably/types'
import { RunList } from '@/features/runs/components/run-list'

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={client}>
      <RunList projectId="proj-1" />
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
    externalId: id,
    reportExternalId: '',
    startedAt: '2026-06-16T10:00:00Z',
    caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
    passRate: 1,
    delta: null,
    ...overrides,
  }
}

describe('RunList report grouping', () => {
  beforeEach(() => {
    listRuns.mockReset()
  })

  it('renders a lone run with no reportExternalId siblings exactly as before, with no group header', async () => {
    listRuns.mockResolvedValue({ items: [runSummary('a', { reportExternalId: 'report-a' })] })

    await act(async () => {
      renderList()
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(screen.queryByText('suites')).not.toBeInTheDocument()
    expect(screen.queryByText('suite')).not.toBeInTheDocument()
  })

  it('groups consecutive runs sharing a reportExternalId under one header with the right suite count', async () => {
    listRuns.mockResolvedValue({
      items: [
        runSummary('a', { reportExternalId: 'report-1' }),
        runSummary('b', { reportExternalId: 'report-1' }),
        runSummary('c', { reportExternalId: 'report-1' }),
      ],
    })

    await act(async () => {
      renderList()
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(screen.getByText('Run b')).toBeInTheDocument()
    expect(screen.getByText('Run c')).toBeInTheDocument()

    const header = screen.getByTestId('run-report-group-header')
    expect(header).toHaveTextContent('3')
    expect(header).toHaveTextContent('suites')
  })

  it('counts failures within the group correctly', async () => {
    listRuns.mockResolvedValue({
      items: [
        runSummary('a', { reportExternalId: 'report-1', status: 'fail' }),
        runSummary('b', { reportExternalId: 'report-1', status: 'pass' }),
        runSummary('c', { reportExternalId: 'report-1', status: 'fail' }),
      ],
    })

    await act(async () => {
      renderList()
    })

    const header = await screen.findByTestId('run-report-group-header')
    expect(within(header).getByText('2')).toBeInTheDocument()
    expect(header).toHaveTextContent('failed')
  })

  it('uses the singular failed form when exactly one suite in the group failed', async () => {
    listRuns.mockResolvedValue({
      items: [
        runSummary('a', { reportExternalId: 'report-1', status: 'fail' }),
        runSummary('b', { reportExternalId: 'report-1', status: 'pass' }),
      ],
    })

    await act(async () => {
      renderList()
    })

    const header = await screen.findByTestId('run-report-group-header')
    expect(within(header).getByText('2')).toBeInTheDocument()
    expect(within(header).getByText('1')).toBeInTheDocument()
  })

  it('announces every suite passed when nothing in the group failed', async () => {
    listRuns.mockResolvedValue({
      items: [
        runSummary('a', { reportExternalId: 'report-1' }),
        runSummary('b', { reportExternalId: 'report-1' }),
      ],
    })

    await act(async () => {
      renderList()
    })

    const header = await screen.findByTestId('run-report-group-header')
    expect(header).toHaveTextContent('all passed')
  })

  it('does not group runs that share the same reportExternalId but are not adjacent', async () => {
    listRuns.mockResolvedValue({
      items: [
        runSummary('a', { reportExternalId: 'report-1' }),
        runSummary('middle', { reportExternalId: 'report-2' }),
        runSummary('c', { reportExternalId: 'report-1' }),
      ],
    })

    await act(async () => {
      renderList()
    })

    expect(await screen.findByText('Run a')).toBeInTheDocument()
    expect(screen.queryByTestId('run-report-group-header')).not.toBeInTheDocument()
  })
})
