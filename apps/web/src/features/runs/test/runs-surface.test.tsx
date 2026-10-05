import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunSummaryRecord } from '@qably/types'
import { CiRunJobGroup } from '@/features/runs/components/ci-run-job-group'
import { CiRunList } from '@/features/runs/components/ci-run-list'
import { CiRunRow } from '@/features/runs/components/ci-run-row'
import { RunList } from '@/features/runs/components/run-list'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { listRuns } from '@/features/runs/api/runs.api'
import { NOW, PROJECT, ciRunJobRun, ciRunSummary } from './ci-run-fixtures'

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

vi.mock('@/features/runs/api/runs.api', () => ({
  listRuns: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const ROW_HOVER = 'hover:bg-runs-hover/60'
const BUTTON_HOVER = 'hover:bg-runs-hover'
const SHARED_HOVER = /(surface|canvas)-hover/

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function runSummary(id: string, overrides: Partial<RunSummaryRecord> = {}): RunSummaryRecord {
  return {
    id,
    projectId: PROJECT,
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

describe('runs surface hover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tints the CI run row with the runs surface instead of the shared hover surface', () => {
    render(<CiRunRow ciRun={ciRunSummary('ci-1')} projectId={PROJECT} now={NOW.getTime()} />)

    const row = screen.getByRole('link')

    expect(row).toHaveClass(ROW_HOVER)
    expect(row.className).not.toMatch(SHARED_HOVER)
  })

  it('tints the suite rows and the disclosure bar of a job group with the runs surface', async () => {
    const user = userEvent.setup()
    render(
      <CiRunJobGroup
        projectId={PROJECT}
        ciRunExternalId="900"
        jobKey="api"
        runs={[ciRunJobRun('fail-1', { status: 'fail' }), ciRunJobRun('pass-1')]}
      />,
    )

    const disclosure = screen.getByRole('button', { name: /without failures/i })

    expect(disclosure).toHaveClass(ROW_HOVER)
    expect(disclosure.className).not.toMatch(SHARED_HOVER)

    await user.click(disclosure)

    const rows = screen.getAllByRole('link')

    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toHaveClass(ROW_HOVER)
      expect(row.className).not.toMatch(SHARED_HOVER)
    }
  })

  it('tints the rows of the Manual list with the runs surface', async () => {
    vi.mocked(listRuns).mockResolvedValue({ items: [runSummary('m1'), runSummary('m2')] })
    render(
      <QueryClientProvider client={createClient()}>
        <RunList projectId={PROJECT} />
      </QueryClientProvider>,
    )

    await screen.findByText('Run m2')
    const rows = screen.getAllByRole('link')

    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).toHaveClass(ROW_HOVER)
      expect(row.className).not.toMatch(SHARED_HOVER)
    }
  })

  it('tints the Load more button of the CI list with the runs surface', async () => {
    vi.mocked(listCiRuns).mockResolvedValue({ items: [ciRunSummary('ci-1')], nextCursor: 'ci-1' })
    render(
      <QueryClientProvider client={createClient()}>
        <CiRunList projectId={PROJECT} />
      </QueryClientProvider>,
    )

    const button = await screen.findByRole('button', { name: /load more/i })

    expect(button).toHaveClass(BUTTON_HOVER)
    expect(button).not.toHaveClass('hover:bg-surface-hover')
  })

  it('tints the Load more button of the Manual list with the runs surface', async () => {
    vi.mocked(listRuns).mockResolvedValue({ items: [runSummary('m1')], nextCursor: 'm1' })
    render(
      <QueryClientProvider client={createClient()}>
        <RunList projectId={PROJECT} />
      </QueryClientProvider>,
    )

    const button = await screen.findByRole('button', { name: /load more/i })

    expect(button).toHaveClass(BUTTON_HOVER)
    expect(button).not.toHaveClass('hover:bg-surface-hover')
  })
})
