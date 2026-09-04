import { render, screen, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CiCommitActivityRecord, DashboardSummaryRecord } from '@qably/types'
import { RecentActivity } from '@/features/dashboard/components/recent-activity'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'
import { useI18nStore } from '@/lib/i18n'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

function ciCommit(
  overrides: Partial<CiCommitActivityRecord> = {},
): CiCommitActivityRecord {
  return {
    commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
    shortSha: 'd2f363d',
    status: 'pass',
    lastRunAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    runCount: 14,
    passedRunCount: 14,
    commitMessage: 'fix(ci): retry throttled run reports instead of dropping them',
    commitAuthor: 'Aisaac2205',
    ...overrides,
  }
}

async function renderWithSummary(summary: Partial<DashboardSummaryRecord>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  client.setQueryData(dashboardKeys.summary('all'), {
    ...dashboardSummaryFixture,
    ...summary,
  })

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <RecentActivity />
      </QueryClientProvider>,
    )
  })
}

describe('RecentActivity', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('names the two queues after what they actually list', async () => {
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    expect(screen.getByText('Test runs')).toBeInTheDocument()
    expect(screen.getByText('Commits in CI')).toBeInTheDocument()
  })

  it('shows recent test runs', async () => {
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    const runTitles = screen.getAllByText(/Run #/)
    expect(runTitles.length).toBeGreaterThan(0)
  })

  it('translates the view-all links instead of hardcoding English', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    expect(screen.getAllByText('Ver todo').length).toBeGreaterThan(0)
    expect(screen.queryByText('View all')).not.toBeInTheDocument()
  })

  it('lists one row per commit instead of repeating the same commit message', async () => {
    await renderWithSummary({
      recentCiCommits: [
        ciCommit(),
        ciCommit({ shortSha: '672d236', commitSha: '672d236aaa', commitMessage: 'fix(api): build scm job ids' }),
      ],
    })

    expect(
      screen.getAllByText(/retry throttled run reports/i),
    ).toHaveLength(1)
    expect(screen.getByText(/build scm job ids/i)).toBeInTheDocument()
  })

  it('states how many of the commit runs passed', async () => {
    await renderWithSummary({
      recentCiCommits: [ciCommit({ runCount: 14, passedRunCount: 12, status: 'fail' })],
    })

    expect(screen.getByText(/12\/14 passed/)).toBeInTheDocument()
  })

  it('shows the commit sha so the row is traceable back to the change', async () => {
    await renderWithSummary({ recentCiCommits: [ciCommit()] })

    expect(screen.getByText(/d2f363d/)).toBeInTheDocument()
  })

  it('rolls the commit status up into a single status chip', async () => {
    await renderWithSummary({
      recentCiCommits: [ciCommit({ status: 'fail', passedRunCount: 12, runCount: 14 })],
    })

    const ciQueue = screen.getByLabelText('Commits in CI')
    expect(within(ciQueue).getByLabelText('Fail')).toBeInTheDocument()
  })

  it('falls back to the short sha when the commit carries no message', async () => {
    await renderWithSummary({
      recentCiCommits: [ciCommit({ commitMessage: undefined })],
    })

    expect(screen.getAllByText(/d2f363d/).length).toBeGreaterThan(0)
  })

  it('tells the user nothing reached CI yet instead of rendering an empty list', async () => {
    await renderWithSummary({ recentCiCommits: [] })

    expect(screen.getByText('No commits checked yet')).toBeInTheDocument()
  })

  it('dates each test run so the row says more than its suite name', async () => {
    const [firstRun] = dashboardSummaryFixture.recentRuns

    await renderWithSummary({
      recentRuns: [
        {
          ...firstRun,
          startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    })

    const runsQueue = screen.getByLabelText('Test runs')
    expect(runsQueue.textContent).toContain('1h ago')
  })

  it('names the outer work queue landmark in the active locale', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })

    expect(screen.getByLabelText('Cola de trabajo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Operational work queue')).not.toBeInTheDocument()
  })
})
