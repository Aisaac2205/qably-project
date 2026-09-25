import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RunSummaryRecord } from '@qably/types'
import { computePassRate } from '@qably/types'
import { mockProjects, mockSuites } from '@/lib/mock-data'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { runKeys } from '@/features/runs/lib/query-keys'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { computeSuiteMetrics, runFixtures, suiteNameById } from '@/test/runs-api-stub'
import { projectFixtures } from '@/test/projects-api-stub'
import { organizationFixtures } from '@/test/organizations-api-stub'
import {
  dashboardChannelsFixture,
  dashboardOverviewFixture,
  dashboardSummaryFixture,
  traceabilityCalendarFixture,
} from '@/test/dashboard-api-stub'
import { projectKeys } from '@/features/projects/lib/query-keys'
import { organizationKeys } from '@/features/organizations/lib/query-keys'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import {
  PROPOSAL_STATUSES,
  proposalDetailFixtures,
  proposalInboxCountsFixtures,
  proposalInboxFixtures,
  proposalListFixtures,
  proposalListFixturesFor,
} from '@/test/review-api-stub'
import type { ReviewInboxStatusFilter } from '@/features/review-inbox/api/review.api'

/**
 * Suites and runs used to come from a synchronous store, so component tests
 * could assert straight after render. They now arrive over react-query, so
 * the cache is seeded with the same fixtures to keep those assertions
 * honest without rewriting every test into a waitFor.
 */
function seedSuites(client: QueryClient): void {
  const suites = structuredClone(mockSuites)

  client.setQueryData(suiteKeys.list('all'), suites)

  for (const projectId of new Set(suites.map((suite) => suite.projectId))) {
    client.setQueryData(
      suiteKeys.list(projectId),
      suites.filter((suite) => suite.projectId === projectId),
    )
  }

  for (const suite of suites) {
    client.setQueryData(suiteKeys.detail(suite.id), suite)
  }
}

function toSummary(run: (typeof runFixtures)[number]): RunSummaryRecord {
  const cases = run.cases
  const caseCounts = {
    total: cases.length,
    pending: cases.filter((c) => c.status === 'pending').length,
    running: cases.filter((c) => c.status === 'running').length,
    pass: cases.filter((c) => c.status === 'pass').length,
    fail: cases.filter((c) => c.status === 'fail').length,
    skip: cases.filter((c) => c.status === 'skip').length,
    blocked: cases.filter((c) => c.status === 'blocked').length,
  }
  return {
    id: run.id,
    projectId: run.projectId,
    organizationId: run.organizationId,
    suiteId: run.suiteId,
    suiteName: suiteNameById[run.suiteId] ?? '',
    name: run.name,
    status: run.status,
    source: run.source,
    externalId: run.externalId,
    reportExternalId: run.externalId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    executedById: run.executedById,
    commitSha: run.commitSha,
    commitMessage: run.commitMessage,
    commitAuthor: run.commitAuthor,
    caseCounts,
    passRate: computePassRate(caseCounts),
    delta: null,
  }
}

function seedRuns(client: QueryClient): void {
  const runs = structuredClone(runFixtures)
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
  const summaries = sorted.map(toSummary)

  client.setQueryData(runKeys.list('all'), { items: summaries })

  for (const projectId of new Set(runs.map((run) => run.projectId))) {
    const forProject = summaries.filter((run) => run.projectId === projectId)

    client.setQueryData(runKeys.list(projectId), { items: forProject })
    client.setQueryData(runKeys.page(projectId, 'all'), {
      pages: [{ items: forProject }],
      pageParams: [undefined],
    })

    for (const source of new Set(forProject.map((run) => run.source))) {
      client.setQueryData(runKeys.page(projectId, source), {
        pages: [{ items: forProject.filter((run) => run.source === source) }],
        pageParams: [undefined],
      })
    }
  }

  for (const run of runs) {
    client.setQueryData(runKeys.detail(run.id), run)
  }
}

function seedSuiteMetrics(client: QueryClient): void {
  for (const projectId of new Set(mockSuites.map((suite) => suite.projectId))) {
    client.setQueryData(
      runKeys.suiteMetrics(projectId),
      structuredClone(computeSuiteMetrics(projectId)),
    )
  }
}

function seedProjects(client: QueryClient): void {
  client.setQueryData(projectKeys.all, structuredClone(projectFixtures))
}

function seedOrganizations(client: QueryClient): void {
  client.setQueryData(organizationKeys.all, structuredClone(organizationFixtures))
}

function seedDashboardSummary(client: QueryClient): void {
  client.setQueryData(
    dashboardKeys.summary('all'),
    structuredClone(dashboardSummaryFixture),
  )
}

function seedTraceability(client: QueryClient): void {
  const record = structuredClone(traceabilityCalendarFixture)

  client.setQueryData(
    dashboardKeys.traceability(record.year, 'all', getBrowserTimeZone()),
    record,
  )
}

function seedDashboardOverview(client: QueryClient): void {
  const record = structuredClone(dashboardOverviewFixture)

  client.setQueryData(
    dashboardKeys.overview(record.period, 'all', getBrowserTimeZone()),
    record,
  )
}

function seedDashboardChannels(client: QueryClient): void {
  const record = structuredClone(dashboardChannelsFixture)

  client.setQueryData(dashboardKeys.channels(getBrowserTimeZone()), record)
}

function seedProposals(client: QueryClient): void {
  client.setQueryData(reviewKeys.list(), proposalListFixtures())

  for (const detail of proposalDetailFixtures()) {
    client.setQueryData(reviewKeys.detail(detail.id), detail)
  }

  const projectIds = new Set(proposalListFixtures().map((proposal) => proposal.projectId))

  for (const projectId of projectIds) {
    client.setQueryData(reviewKeys.list({ projectId }), proposalListFixturesFor({ projectId }))

    for (const status of PROPOSAL_STATUSES) {
      client.setQueryData(
        reviewKeys.list({ projectId, status }),
        proposalListFixturesFor({ projectId, status }),
      )
    }
  }
}

const INBOX_STATUS_FILTERS: ReviewInboxStatusFilter[] = [
  'in_review',
  'all',
  'approved',
  'rejected',
  'changes_requested',
]

function seedInboxPages(client: QueryClient): void {
  const projectIds = [undefined, ...mockProjects.map((project) => project.id)]

  for (const projectId of projectIds) {
    for (const status of INBOX_STATUS_FILTERS) {
      for (const duplicatesOnly of [undefined, true]) {
        const filters = { projectId, status, duplicatesOnly, search: undefined }
        const items = proposalInboxFixtures(filters)

        client.setQueryData(reviewKeys.inbox(filters), {
          pages: [{ items, nextCursor: null }],
          pageParams: [null],
        })
      }
    }
  }
}

function seedInboxCounts(client: QueryClient): void {
  const projectIds = [undefined, ...mockProjects.map((project) => project.id)]

  for (const projectId of projectIds) {
    const filters = { projectId, search: undefined }

    client.setQueryData(reviewKeys.inboxCounts(filters), {
      byStatus: proposalInboxCountsFixtures(filters),
      version: 'test-version',
    })
  }
}

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  seedSuites(client)
  seedRuns(client)
  seedSuiteMetrics(client)
  seedProjects(client)
  seedOrganizations(client)
  seedDashboardSummary(client)
  seedTraceability(client)
  seedDashboardOverview(client)
  seedDashboardChannels(client)
  seedProposals(client)
  seedInboxPages(client)
  seedInboxCounts(client)

  return client
}

export function withQueryClient(children: ReactNode): ReactElement {
  return (
    <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
  )
}

export function renderWithQuery(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(withQueryClient(ui), options)
}
