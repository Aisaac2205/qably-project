/**
 * Mock data for the Qably dashboard preview.
 * Conforms 100% to @qably/types (DashboardOverviewRecord, DashboardChannelsRecord)
 * so the preview renders identically to apps/web without requiring live backend queries.
 */
import type {
  DashboardChannelsRecord,
  DashboardOverviewRecord,
  DashboardPeriod,
  DailyPoint,
} from '@qably/types'

export const MOCK_DEMO_USER = {
  name: 'Isaac Sarceño',
  email: 'isaac@qably.dev',
  initials: 'IS',
}


const MOCK_PROJECTS = [
  {
    id: 'proj-core',
    name: 'Qably Platform Core',
    suites: 24,
    cases: 840,
    passRate: 0.994,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'proj-billing',
    name: 'Billing & Subscriptions API',
    suites: 16,
    cases: 420,
    passRate: 0.982,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'proj-auth',
    name: 'Auth & Identity Service',
    suites: 12,
    cases: 310,
    passRate: 1,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'proj-sdk',
    name: 'Typescript Ingestion SDK',
    suites: 8,
    cases: 195,
    passRate: 0.968,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
]

const PORTFOLIO_CASE_TOTAL = MOCK_PROJECTS.reduce((sum, project) => sum + project.cases, 0)

function buildCasePriorities(totalCases: number) {
  const critical = Math.round(totalCases * 0.08)
  const high = Math.round(totalCases * 0.19)
  const low = Math.round(totalCases * 0.14)
  const medium = Math.max(0, totalCases - critical - high - low)
  return { critical, high, medium, low }
}

function generateDailyPoints(days: number, isCurrent: boolean): DailyPoint[] {
  const points: DailyPoint[] = []
  const today = new Date(2026, 8, 28) // Sept 28, 2026

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    if (isCurrent) {
      d.setDate(today.getDate() - i)
    } else {
      d.setDate(today.getDate() - days - i)
    }

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    // Deterministic organic curve
    const cycle = Math.sin((i / days) * Math.PI * 2) * 0.4 + 1
    const baseExecuted = Math.round((isCurrent ? 280 : 210) * cycle + (i % 3 === 0 ? 95 : 30))
    const runs = Math.max(1, Math.round(baseExecuted / 38))
    const failed = i % 5 === 0 ? Math.round(baseExecuted * 0.04) : i % 3 === 0 ? 2 : 0
    const blocked = i % 7 === 0 ? 1 : 0
    const passed = Math.max(0, baseExecuted - failed - blocked)
    const failedRuns = failed > 0 ? 1 : 0
    const passRate = baseExecuted > 0 ? passed / baseExecuted : 1

    points.push({
      date: dateStr,
      rangeEnd: dateStr,
      executed: baseExecuted,
      runs,
      failed,
      failedRuns,
      passed,
      blocked,
      passRate,
    })
  }

  return points
}

const POINTS_7_CURRENT = generateDailyPoints(7, true)
const POINTS_7_PREV = generateDailyPoints(7, false)

const POINTS_30_CURRENT = generateDailyPoints(30, true)
const POINTS_30_PREV = generateDailyPoints(30, false)

const POINTS_90_CURRENT = generateDailyPoints(90, true)
const POINTS_90_PREV = generateDailyPoints(90, false)

function createOverview(period: DashboardPeriod): DashboardOverviewRecord {
  const current =
    period === 7 ? POINTS_7_CURRENT : period === 30 ? POINTS_30_CURRENT : POINTS_90_CURRENT
  const previous =
    period === 7 ? POINTS_7_PREV : period === 30 ? POINTS_30_PREV : POINTS_90_PREV

  const totalExecuted = current.reduce((sum, p) => sum + p.executed, 0)
  const prevExecuted = previous.reduce((sum, p) => sum + p.executed, 0)

  const totalRuns = current.reduce((sum, p) => sum + p.runs, 0)
  const prevRuns = previous.reduce((sum, p) => sum + p.runs, 0)

  const totalFailed = current.reduce((sum, p) => sum + p.failed, 0)
  const prevFailed = previous.reduce((sum, p) => sum + p.failed, 0)

  const totalPassed = current.reduce((sum, p) => sum + p.passed, 0)
  const passRate = totalExecuted > 0 ? totalPassed / totalExecuted : 1

  return {
    period,
    timeZone: 'America/Guatemala',
    kpis: {
      passRate: {
        value: passRate,
        previous: 0.984,
        series: current.map((p) => p.passRate),
      },
      runs: {
        value: totalRuns,
        previous: prevRuns,
        series: current.map((p) => p.runs),
      },
      failedCases: {
        value: totalFailed,
        previous: prevFailed,
        series: current.map((p) => p.failed),
      },
      avgRunDurationMs: {
        value: 4200,
        previous: 4500,
        series: [4100, 4200, 4300, 4200],
      },
    },
    passRateSeries: {
      current,
      previous,
      granularity: period === 90 ? 'week' : 'day',
    },
    casesPassing: {
      total: totalExecuted,
      pending: 0,
      running: 0,
      pass: totalPassed,
      fail: totalFailed,
      blocked: 12,
      skip: 28,
    },
    casePriorities: buildCasePriorities(PORTFOLIO_CASE_TOTAL),
    projects: MOCK_PROJECTS,
    recentActivity: [
      {
        kind: 'commit',
        occurredAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
        projectId: 'proj-core',
        projectName: 'Qably Platform Core',
        status: 'pass',
        source: 'github_actions',
        suiteCount: 24,
        casesPassed: 835,
        casesTotal: 840,
        commitSha: 'd8c72f1a9b402e1c7f5a8e2',
        commitMessage: 'feat(runs): optimize daily pass-rate aggregation queries',
      },
      {
        kind: 'run',
        occurredAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        projectId: 'proj-billing',
        projectName: 'Billing & Subscriptions API',
        runId: 'run-9842',
        runName: 'Nightly E2E Regression #412',
        suiteName: 'All E2E Test Suites',
        status: 'pass',
        source: 'github_actions',
        casesPassed: 412,
        casesTotal: 420,
      },
      {
        kind: 'commit',
        occurredAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
        projectId: 'proj-auth',
        projectName: 'Auth & Identity Service',
        status: 'pass',
        source: 'api',
        suiteCount: 12,
        casesPassed: 310,
        casesTotal: 310,
        commitSha: '4b901ec419f8a32',
        commitMessage: 'fix(session): enforce token revocation on logout',
      },
      {
        kind: 'run',
        occurredAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        projectId: 'proj-sdk',
        projectName: 'Typescript Ingestion SDK',
        runId: 'run-9840',
        runName: 'Integration Tests CI',
        suiteName: 'SDK Suite',
        status: 'fail',
        source: 'github_actions',
        casesPassed: 189,
        casesTotal: 195,
      },
    ],
  }
}

export const MOCK_DASHBOARD_OVERVIEWS: Record<DashboardPeriod, DashboardOverviewRecord> = {
  7: createOverview(7),
  30: createOverview(30),
  90: createOverview(90),
}

export const MOCK_DASHBOARD_CHANNELS: DashboardChannelsRecord = {
  webhooks: [
    {
      id: 'wh-slack',
      type: 'slack',
      name: 'Slack #qa-incidents',
      eventTypes: ['run_failed', 'case_regressed'],
      sent: 1420,
      failed: 0,
      daily: [
        { date: '2026-09-22', sent: 18, failed: 0 },
        { date: '2026-09-23', sent: 24, failed: 0 },
        { date: '2026-09-24', sent: 12, failed: 0 },
        { date: '2026-09-25', sent: 35, failed: 0 },
        { date: '2026-09-26', sent: 48, failed: 0 },
        { date: '2026-09-27', sent: 15, failed: 0 },
        { date: '2026-09-28', sent: 22, failed: 0 },
      ],
    },
    {
      id: 'wh-discord',
      type: 'discord',
      name: 'Discord #engineering',
      eventTypes: ['run_failed'],
      sent: 850,
      failed: 2,
      daily: [
        { date: '2026-09-22', sent: 10, failed: 0 },
        { date: '2026-09-23', sent: 14, failed: 1 },
        { date: '2026-09-24', sent: 8, failed: 0 },
        { date: '2026-09-25', sent: 20, failed: 0 },
        { date: '2026-09-26', sent: 32, failed: 1 },
        { date: '2026-09-27', sent: 12, failed: 0 },
        { date: '2026-09-28', sent: 16, failed: 0 },
      ],
    },
  ],
  email: {
    enabled: true,
    eventTypes: ['run_failed'],
    sent: 320,
    failed: 0,
    daily: [
      { date: '2026-09-22', sent: 4, failed: 0 },
      { date: '2026-09-23', sent: 6, failed: 0 },
      { date: '2026-09-24', sent: 2, failed: 0 },
      { date: '2026-09-25', sent: 8, failed: 0 },
      { date: '2026-09-26', sent: 12, failed: 0 },
      { date: '2026-09-27', sent: 3, failed: 0 },
      { date: '2026-09-28', sent: 5, failed: 0 },
    ],
  },
  inApp: {
    sent: 2450,
    unread: 4,
    daily: [
      { date: '2026-09-22', sent: 45, failed: 0 },
      { date: '2026-09-23', sent: 62, failed: 0 },
      { date: '2026-09-24', sent: 38, failed: 0 },
      { date: '2026-09-25', sent: 88, failed: 0 },
      { date: '2026-09-26', sent: 120, failed: 0 },
      { date: '2026-09-27', sent: 42, failed: 0 },
      { date: '2026-09-28', sent: 58, failed: 0 },
    ],
  },
  lastDelivery: {
    webhookId: 'wh-slack',
    channel: 'slack',
    eventType: 'run_failed',
    status: 'sent',
    deliveredAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
}
