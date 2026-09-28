import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { en, es } from '@qably/i18n'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import type {
  DashboardSummaryRecord,
  ProjectSummary,
  PushPassRateRecord,
  RegressionsRecord,
} from '@qably/types'
import { QualityPage } from '@/features/projects/quality/components/quality-page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const getProject = vi.fn()
const getDashboardSummary = vi.fn()
const getDashboardOverview = vi.fn()
const getRegressions = vi.fn()
const getPushPassRate = vi.fn()

vi.mock('@/features/projects/api/projects.api', () => ({
  getProject: (...args: unknown[]) => getProject(...args),
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardSummary: (...args: unknown[]) => getDashboardSummary(...args),
  getDashboardOverview: (...args: unknown[]) => getDashboardOverview(...args),
}))

vi.mock('@/features/runs/api/runs.api', () => ({
  getRegressions: (...args: unknown[]) => getRegressions(...args),
  getPushPassRate: (...args: unknown[]) => getPushPassRate(...args),
  listRuns: vi.fn(),
  getSuiteMetrics: vi.fn(),
  getRun: vi.fn(),
  createRun: vi.fn(),
  updateRunCase: vi.fn(),
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

const pushPassRate: PushPassRateRecord = {
  items: [
    {
      commitSha: 'commit-1-sha',
      shortSha: 'commit1',
      startedAt: '2026-06-15T10:00:00Z',
      open: 0.75,
      high: 0.85,
      low: 0.7,
      close: 0.8,
      runCount: 2,
      passRate: 0.8,
      executed: 10,
      passed: 8,
      failed: 2,
      blocked: 0,
    },
    {
      commitSha: 'commit-2-sha',
      shortSha: 'commit2',
      startedAt: '2026-06-16T10:00:00Z',
      open: 0.8,
      high: 1,
      low: 0.8,
      close: 1,
      runCount: 3,
      passRate: 1,
      executed: 15,
      passed: 15,
      failed: 0,
      blocked: 0,
    },
  ],
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
    getProject.mockResolvedValue(project)
    getDashboardSummary.mockResolvedValue(summary)
    getDashboardOverview.mockResolvedValue(dashboardOverviewFixture)
    getRegressions.mockResolvedValue(regressions)
    getPushPassRate.mockResolvedValue(pushPassRate)
  })

  it('renders the page header without waiting for the chart queries', async () => {
    getDashboardOverview.mockReturnValue(new Promise(() => {}))
    getPushPassRate.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      renderPage()
    })

    expect(await screen.findByRole('heading', { name: 'Ecommerce App' })).toBeInTheDocument()
  })

  it('never requests the dashboard summary, which the page does not read', async () => {
    await act(async () => {
      renderPage()
    })

    expect(getDashboardSummary).not.toHaveBeenCalled()
  })

  it('keeps the header and the other sections up when one query fails', async () => {
    getPushPassRate.mockRejectedValue(new Error('network down'))

    await act(async () => {
      renderPage()
    })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ecommerce App' })).toBeInTheDocument()
    expect(await screen.findByText('Executed cases')).toBeInTheDocument()
  })

  describe('once loaded', () => {
    beforeEach(async () => {
      await act(async () => {
        renderPage()
      })
    })

    it('renders the project name in the page header', async () => {
      expect(await screen.findByRole('heading', { name: 'Ecommerce App' })).toBeInTheDocument()
    })

    it('renders the 4 KPI stat tiles from the dashboard strip', async () => {
      expect(await screen.findByText('Executed cases')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'Runs' })).toBeInTheDocument()
      expect(screen.getByText('Failed cases')).toBeInTheDocument()
      expect(screen.getByText('Runs with failures')).toBeInTheDocument()
    })

    it('exposes the pass-rate change per push through an accessible table', async () => {
      const table = await screen.findByRole('table', { name: /pass rate over the last/i })
      expect(within(table).getByText('Commit')).toBeInTheDocument()
      expect(within(table).getByText('commit2')).toBeInTheDocument()
      expect(within(table).getByText('+20%')).toBeInTheDocument()
    })

    it('omits the first push, which has no predecessor to compare against', async () => {
      const table = await screen.findByRole('table', { name: /pass rate over the last/i })
      expect(within(table).queryByText('commit1')).not.toBeInTheDocument()
    })

    it('renders the daily test execution activity as a passed/failed/blocked stacked chart', async () => {
      expect(await screen.findByRole('heading', { name: 'Test execution activity' })).toBeInTheDocument()
      expect(screen.getAllByText('Passed').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Failed').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0)
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
    expect(keyPaths(es.quality).sort()).toEqual(keyPaths(en.quality).sort())
  })
})
