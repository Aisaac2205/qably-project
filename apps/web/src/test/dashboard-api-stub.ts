import type {
  CiCommitActivityRecord,
  DashboardChannelsRecord,
  DashboardOverviewRecord,
  DashboardSummaryRecord,
  RunSummaryRecord,
  TraceabilityCalendarRecord,
} from '@qably/types'
import { computePassRate } from '@qably/types'
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

export const dashboardOverviewFixture: DashboardOverviewRecord = {
  period: 30,
  timeZone: 'America/Guatemala',
  kpis: {
    passRate: { value: 0.82, previous: 0.75, series: [0.8, 0.85, null, 0.9] },
    runs: { value: 42, previous: 35, series: [10, 12, 0, 20] },
    failedCases: { value: 6, previous: 9, series: [2, 1, 0, 3] },
    avgRunDurationMs: {
      value: 184320,
      previous: 210500,
      series: [180000, 190000, null, 185000],
    },
  },
  passRateSeries: {
    current: [
      { date: '2026-06-13', passRate: 0.8, runs: 10, failedRuns: 2 },
      { date: '2026-06-14', passRate: 0.85, runs: 12, failedRuns: 1 },
      { date: '2026-06-15', passRate: null, runs: 0, failedRuns: 0 },
      { date: '2026-06-16', passRate: 0.9, runs: 20, failedRuns: 3 },
    ],
    previous: [
      { date: '2026-05-14', passRate: 0.7, runs: 8, failedRuns: 2 },
      { date: '2026-05-15', passRate: 0.75, runs: 9, failedRuns: 2 },
      { date: '2026-05-16', passRate: null, runs: 0, failedRuns: 0 },
      { date: '2026-05-17', passRate: 0.78, runs: 10, failedRuns: 2 },
    ],
  },
  casesPassing: { total: 120, pending: 0, running: 0, pass: 98, fail: 12, skip: 5, blocked: 5 },
  projects: [
    {
      id: 'project-1',
      name: 'Checkout Web',
      suites: 3,
      cases: 40,
      passRate: 0.82,
      lastRunAt: '2026-06-16T10:00:00.000Z',
    },
    {
      id: 'project-2',
      name: 'Mobile App',
      suites: 2,
      cases: 18,
      passRate: 0.45,
      lastRunAt: '2026-06-15T08:30:00.000Z',
    },
    {
      id: 'project-3',
      name: 'Internal Tools',
      suites: 1,
      cases: 0,
      passRate: null,
    },
  ],
  recentRuns: [
    {
      id: 'run-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Checkout regression',
      status: 'pass',
      source: 'github_actions',
      startedAt: '2026-06-16T10:00:00.000Z',
      finishedAt: '2026-06-16T10:12:00.000Z',
      commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
      commitMessage: 'fix(ci): retry throttled run reports',
      commitAuthor: 'Aisaac2205',
      passRate: 1,
      casesPassed: 12,
      casesTotal: 12,
    },
    {
      id: 'run-2',
      projectId: 'project-2',
      projectName: 'Mobile App',
      suiteId: 'suite-2',
      suiteName: 'Auth',
      name: 'Auth smoke',
      status: 'fail',
      source: 'api',
      startedAt: '2026-06-16T09:00:00.000Z',
      finishedAt: '2026-06-16T09:05:00.000Z',
      passRate: 0.6,
      casesPassed: 3,
      casesTotal: 5,
    },
    {
      id: 'run-3',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      suiteId: 'suite-1',
      suiteName: 'Checkout',
      name: 'Manual smoke',
      status: 'pass',
      source: 'manual',
      startedAt: '2026-06-16T08:00:00.000Z',
      finishedAt: '2026-06-16T08:04:00.000Z',
      passRate: 1,
      casesPassed: 6,
      casesTotal: 6,
    },
    {
      id: 'run-4',
      projectId: 'project-2',
      projectName: 'Mobile App',
      suiteId: 'suite-2',
      suiteName: 'Auth',
      name: 'Auth regression',
      status: 'running',
      source: 'github_actions',
      startedAt: '2026-06-16T07:00:00.000Z',
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4',
      commitMessage: 'feat(auth): add device binding',
      commitAuthor: 'Aisaac2205',
      passRate: null,
      casesPassed: 0,
      casesTotal: 0,
    },
  ],
}

export function getDashboardOverview(): Promise<DashboardOverviewRecord> {
  return Promise.resolve(dashboardOverviewFixture)
}

export const dashboardChannelsFixture: DashboardChannelsRecord = {
  webhooks: [
    {
      id: 'webhook-1',
      type: 'slack',
      name: 'Team Slack',
      eventTypes: ['run_failed'],
      sent: 12,
      failed: 2,
      daily: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-06-${String(index + 3).padStart(2, '0')}`,
        sent: index === 13 ? 0 : 1,
        failed: index === 13 ? 2 : 0,
      })),
    },
    {
      id: 'webhook-2',
      type: 'discord',
      name: 'QA Alerts',
      eventTypes: ['run_completed'],
      sent: 8,
      failed: 0,
      daily: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-06-${String(index + 3).padStart(2, '0')}`,
        sent: index === 13 ? 0 : 1,
        failed: 0,
      })),
    },
  ],
  email: { enabled: true, eventTypes: ['case_regressed', 'connection_security'] },
  lastDelivery: {
    webhookId: 'webhook-1',
    eventType: 'run_failed',
    status: 'sent',
    deliveredAt: '2026-06-15T10:00:00.000Z',
  },
}

export function getDashboardChannels(): Promise<DashboardChannelsRecord> {
  return Promise.resolve(dashboardChannelsFixture)
}
