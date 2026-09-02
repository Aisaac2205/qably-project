import type { DashboardSummaryRecord, RunSummaryRecord } from '@qably/types'
import { runFixtures } from './runs-api-stub'

function countCases(cases: { status: string }[]) {
  const counts = {
    total: cases.length,
    pending: 0,
    running: 0,
    pass: 0,
    fail: 0,
    skip: 0,
    blocked: 0,
  }
  for (const c of cases) {
    counts[c.status as keyof typeof counts]++
  }
  return counts
}

function toSummary(run: (typeof runFixtures)[number]): RunSummaryRecord {
  const caseCounts = countCases(run.cases)
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

const sortedRuns = [...runFixtures].sort(
  (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
)

export const dashboardSummaryFixture: DashboardSummaryRecord = {
  totalProjects: 4,
  totalSuites: 3,
  totalRuns: runFixtures.length,
  runsInWindow: runFixtures.length,
  activeRuns: runFixtures.filter((run) => run.status === 'running').length,
  passRate: 0.89,
  passRateTrend: 0.12,
  defectsDetected: 2,
  windowDays: 7,
  recentRuns: sortedRuns.slice(0, 5).map(toSummary),
  recentCiRuns: sortedRuns
    .filter((run) => run.source === 'github_actions')
    .slice(0, 5)
    .map(toSummary),
}

export function getDashboardSummary(): Promise<DashboardSummaryRecord> {
  return Promise.resolve(dashboardSummaryFixture)
}

export function __resetDashboardStub(): void {}
