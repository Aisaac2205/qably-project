import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { en, es } from '@qably/i18n'
import type {
  DashboardSummaryRecord,
  ProjectSummary,
  RegressionsRecord,
  RunsPageRecord,
  SuiteMetricsRecord,
  TraceabilityCalendarRecord,
} from '@qably/types'
import type { ProposalListItem } from '@/features/review-inbox/api/review.api'
import { QualityPage } from '@/features/projects/quality/components/quality-page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const getProject = vi.fn()
const getDashboardSummary = vi.fn()
const getTraceabilityCalendar = vi.fn()
const listRuns = vi.fn()
const getRegressions = vi.fn()
const getSuiteMetrics = vi.fn()
const listProposals = vi.fn()

vi.mock('@/features/projects/api/projects.api', () => ({
  getProject: (...args: unknown[]) => getProject(...args),
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardSummary: (...args: unknown[]) => getDashboardSummary(...args),
  getTraceabilityCalendar: (...args: unknown[]) => getTraceabilityCalendar(...args),
}))

vi.mock('@/features/runs/api/runs.api', () => ({
  listRuns: (...args: unknown[]) => listRuns(...args),
  getRegressions: (...args: unknown[]) => getRegressions(...args),
  getSuiteMetrics: (...args: unknown[]) => getSuiteMetrics(...args),
  getRun: vi.fn(),
  createRun: vi.fn(),
  updateRunCase: vi.fn(),
}))

vi.mock('@/features/review-inbox/api/review.api', () => ({
  listProposals: (...args: unknown[]) => listProposals(...args),
  getProposal: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}))

const project: ProjectSummary = {
  id: 'proj-1',
  name: 'Ecommerce App',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  healthScore: 90,
  lastRunStatus: 'pass',
  lastRunAt: '2026-06-16T10:00:00Z',
  suiteCount: 2,
  activeRunCount: 0,
  aiPendingCount: 0,
}

const summary: DashboardSummaryRecord = {
  totalProjects: 1,
  totalSuites: 2,
  totalRuns: 12,
  runsInWindow: 5,
  activeRuns: 3,
  passRate: 0.82,
  passRateTrend: 0.05,
  defectsDetected: 1,
  windowDays: 7,
  recentRuns: [],
  recentCiCommits: [],
}

const runsPage: RunsPageRecord = {
  items: [
    {
      id: 'run-2',
      projectId: 'proj-1',
      organizationId: 'org-1',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Run #2',
      status: 'pass',
      source: 'manual',
      externalId: '',
      startedAt: '2026-06-16T10:00:00Z',
      finishedAt: '2026-06-16T10:05:00Z',
      caseCounts: { total: 4, pending: 0, running: 0, pass: 4, fail: 0, skip: 0, blocked: 0 },
      passRate: 1,
    },
    {
      id: 'run-1',
      projectId: 'proj-1',
      organizationId: 'org-1',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Run #1',
      status: 'fail',
      source: 'manual',
      externalId: '',
      startedAt: '2026-06-15T10:00:00Z',
      finishedAt: '2026-06-15T10:05:00Z',
      caseCounts: { total: 4, pending: 0, running: 0, pass: 3, fail: 1, skip: 0, blocked: 0 },
      passRate: 0.75,
    },
  ],
}

const regressions: RegressionsRecord = {
  items: [
    {
      runId: 'run-2',
      runName: 'Run #2',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      testCaseId: 'case-1',
      caseName: 'Applies discount code',
      previousRunId: 'run-1',
      detectedAt: '2026-06-16T10:05:00Z',
    },
  ],
  runsScanned: 2,
}

const suiteMetrics: SuiteMetricsRecord = {
  items: [
    {
      suiteId: 'suite-1',
      lastRun: {
        id: 'run-2',
        status: 'pass',
        source: 'manual',
        startedAt: '2026-06-16T10:00:00Z',
        finishedAt: '2026-06-16T10:05:00Z',
        passRate: 1,
      },
      trend: ['fail', 'pass'],
    },
  ],
}

const proposals: ProposalListItem[] = [
  {
    id: 'proposal-1',
    projectId: 'proj-1',
    evidenceId: 'evidence-1',
    evidenceTitle: 'src/checkout.test.ts',
    status: 'in_review',
    title: 'Discount code applies correctly',
    objective: '',
    preconditions: [],
    steps: [],
    expectedResult: '',
    priority: 'medium',
    createdAt: '2026-06-16T10:00:00Z',
    updatedAt: '2026-06-16T10:00:00Z',
  } as unknown as ProposalListItem,
  {
    id: 'proposal-2',
    projectId: 'proj-1',
    evidenceId: 'evidence-2',
    evidenceTitle: 'src/cart.test.ts',
    status: 'in_review',
    title: 'Removes item from cart',
    objective: '',
    preconditions: [],
    steps: [],
    expectedResult: '',
    priority: 'medium',
    createdAt: '2026-06-16T10:00:00Z',
    updatedAt: '2026-06-16T10:00:00Z',
  } as unknown as ProposalListItem,
]

const emptyTraceability: TraceabilityCalendarRecord = {
  year: 2026,
  timeZone: 'America/Guatemala',
  totals: { scm: 0, proposals: 0, official: 0, runs: 0 },
  days: [],
}

function renderPage(projectId = 'proj-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={client}>
      <QualityPage projectId={projectId} />
    </QueryClientProvider>,
  )
}

describe('QualityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTraceabilityCalendar.mockResolvedValue(emptyTraceability)
  })

  it('shows a loading state while the quality summary is being fetched', async () => {
    getProject.mockResolvedValue(project)
    getDashboardSummary.mockReturnValue(new Promise(() => {}))
    listRuns.mockResolvedValue(runsPage)
    getRegressions.mockResolvedValue(regressions)
    getSuiteMetrics.mockResolvedValue(suiteMetrics)
    listProposals.mockResolvedValue(proposals)

    await act(async () => {
      renderPage()
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state with a retry action when the summary fails to load', async () => {
    getProject.mockResolvedValue(project)
    getDashboardSummary.mockRejectedValue(new Error('network down'))
    listRuns.mockResolvedValue(runsPage)
    getRegressions.mockResolvedValue(regressions)
    getSuiteMetrics.mockResolvedValue(suiteMetrics)
    listProposals.mockResolvedValue(proposals)

    await act(async () => {
      renderPage()
    })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: 'Retry' })

    getDashboardSummary.mockResolvedValue(summary)
    await act(async () => {
      retryButton.click()
    })

    expect(await screen.findByText('82%')).toBeInTheDocument()
  })

  describe('once loaded', () => {
    beforeEach(async () => {
      getProject.mockResolvedValue(project)
      getDashboardSummary.mockResolvedValue(summary)
      listRuns.mockResolvedValue(runsPage)
      getRegressions.mockResolvedValue(regressions)
      getSuiteMetrics.mockResolvedValue(suiteMetrics)
      listProposals.mockResolvedValue(proposals)

      await act(async () => {
        renderPage()
      })
    })

    it('renders the project name in the page header', async () => {
      expect(await screen.findByRole('heading', { name: 'Ecommerce App' })).toBeInTheDocument()
    })

    it('shows the pass rate KPI with its value and a link to runs', async () => {
      await screen.findByText('82%')
      const passRateLink = screen.getByText('82%').closest('a')
      expect(passRateLink).toHaveAttribute('href', '/projects/proj-1/runs')
    })

    it('shows the pending proposals KPI linking to the AI review inbox', async () => {
      const value = await screen.findByText('2', { selector: 'dd' })
      expect(value.closest('a')).toHaveAttribute('href', '/projects/proj-1/ai-review')
    })

    it('shows the regressions KPI linking to the regressions section', async () => {
      const kpiValues = await screen.findAllByText('1', { selector: 'dd' })
      const regressionsLink = kpiValues
        .map((el) => el.closest('a'))
        .find((a) => a?.getAttribute('href') === '#quality-regressions')
      expect(regressionsLink).toBeTruthy()
    })

    it('lists the detected regression with a link to its run', async () => {
      const caseName = await screen.findByText('Applies discount code')
      const link = caseName.closest('a')
      expect(link).toHaveAttribute('href', '/projects/proj-1/runs/run-2')
    })

    it('renders the suites health table with the suite name linking to the suite', async () => {
      const table = await screen.findByRole('table', { name: 'Suite health overview' })
      const link = within(table).getByRole('link', { name: 'Checkout' })
      expect(link).toHaveAttribute('href', '/projects/proj-1/suites/suite-1')
    })

    it('renders the pass rate trend as an accessible figure with a data table', async () => {
      const image = await screen.findByRole('img', { name: /Pass rate over the last/i })
      const figure = image.closest('figure')
      expect(figure).not.toBeNull()
      expect(within(figure as HTMLElement).getByRole('table')).toBeInTheDocument()
    })
  })

  describe('empty regressions', () => {
    it('explains why the list is empty, citing the scanned window', async () => {
      getProject.mockResolvedValue(project)
      getDashboardSummary.mockResolvedValue(summary)
      listRuns.mockResolvedValue(runsPage)
      getRegressions.mockResolvedValue({ items: [], runsScanned: 5 })
      getSuiteMetrics.mockResolvedValue(suiteMetrics)
      listProposals.mockResolvedValue(proposals)

      await act(async () => {
        renderPage()
      })

      expect(await screen.findByText('No regressions in the last 5 runs')).toBeInTheDocument()
    })
  })
})

function keyPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof nested === 'object' && nested !== null
      ? keyPaths(nested as Record<string, unknown>, path)
      : [path]
  })
}

describe('quality i18n parity', () => {
  it('keeps the quality translation keys in parity between English and Spanish', () => {
    expect(keyPaths(es.quality)).toEqual(keyPaths(en.quality))
  })
})
