import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RunSummaryRecord } from '@qably/types'
import { mockSuites } from '@/lib/mock-data'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { runKeys } from '@/features/runs/lib/query-keys'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { runFixtures } from '@/test/runs-api-stub'
import { projectFixtures } from '@/test/projects-api-stub'
import { organizationFixtures } from '@/test/organizations-api-stub'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'
import { projectKeys } from '@/features/projects/lib/query-keys'
import { organizationKeys } from '@/features/organizations/lib/query-keys'

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
    name: run.name,
    status: run.status,
    source: run.source,
    externalId: run.externalId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    executedById: run.executedById,
    commitSha: run.commitSha,
    commitMessage: run.commitMessage,
    commitAuthor: run.commitAuthor,
    caseCounts,
    passRate: caseCounts.total === 0 ? 0 : caseCounts.pass / caseCounts.total,
  }
}

function seedRuns(client: QueryClient): void {
  const runs = structuredClone(runFixtures)
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
  const summaries = sorted.map(toSummary)

  client.setQueryData(runKeys.list('all'), summaries)

  for (const projectId of new Set(runs.map((run) => run.projectId))) {
    client.setQueryData(
      runKeys.list(projectId),
      summaries.filter((run) => run.projectId === projectId),
    )
  }

  for (const run of runs) {
    client.setQueryData(runKeys.detail(run.id), run)
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

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  seedSuites(client)
  seedRuns(client)
  seedProjects(client)
  seedOrganizations(client)
  seedDashboardSummary(client)

  return client
}

export function withQueryClient(children: ReactNode): ReactElement {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

export function renderWithQuery(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  return render(withQueryClient(ui), options)
}
