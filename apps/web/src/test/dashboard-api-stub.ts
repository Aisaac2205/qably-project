import type {
  CiCommitActivityRecord,
  DashboardSummaryRecord,
  RunSummaryRecord,
  TraceabilityCalendarRecord,
} from '@qably/types'
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
    suiteName: '',
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

function buildCiCommits(): CiCommitActivityRecord[] {
  const byCommit = new Map<string, CiCommitActivityRecord>()

  for (const run of sortedRuns) {
    if (run.source !== 'github_actions' || !run.commitSha) continue

    const existing = byCommit.get(run.commitSha)
    const passed = run.status === 'pass' ? 1 : 0

    if (existing === undefined) {
      byCommit.set(run.commitSha, {
        commitSha: run.commitSha,
        shortSha: run.commitSha.slice(0, 7),
        status: run.status,
        lastRunAt: run.startedAt,
        runCount: 1,
        passedRunCount: passed,
        ...(run.commitMessage === undefined ? {} : { commitMessage: run.commitMessage }),
        ...(run.commitAuthor === undefined ? {} : { commitAuthor: run.commitAuthor }),
      })
      continue
    }

    byCommit.set(run.commitSha, {
      ...existing,
      status: run.status === 'fail' ? 'fail' : existing.status,
      runCount: existing.runCount + 1,
      passedRunCount: existing.passedRunCount + passed,
    })
  }

  return [...byCommit.values()]
}

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
  recentCiCommits: buildCiCommits(),
}

export function getDashboardSummary(): Promise<DashboardSummaryRecord> {
  return Promise.resolve(dashboardSummaryFixture)
}

export function __resetDashboardStub(): void {}

const traceabilityYear = new Date().getFullYear()

export const traceabilityCalendarFixture: TraceabilityCalendarRecord = {
  year: traceabilityYear,
  timeZone: 'America/Guatemala',
  totals: { scm: 4, proposals: 0, official: 9, runs: 217 },
  days: [
    {
      date: `${traceabilityYear}-06-15`,
      scm: 2,
      proposals: 0,
      official: 4,
      runs: 3,
    },
    {
      date: `${traceabilityYear}-06-16`,
      scm: 2,
      proposals: 0,
      official: 5,
      runs: 214,
    },
  ],
}

export function getTraceabilityCalendar(): Promise<TraceabilityCalendarRecord> {
  return Promise.resolve(traceabilityCalendarFixture)
}
