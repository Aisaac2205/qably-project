import { describe, it, expect } from 'vitest'
import type { Run, Suite } from '@qably/types'
import {
  toLocalDateString,
  getLastRun,
  getPassRateLastNDays,
  getSparklineData,
  getSuiteRunStatus,
  aggregateForProject,
} from '@/lib/execution-metrics'

// Fixed reference time for deterministic tests.
const NOW = new Date('2026-06-16T11:00:00Z').getTime()
const NOW_ISO = '2026-06-16T11:00:00Z'

// ── Helpers ─────────────────────────────────────────────────────────────

function makeRun(overrides: Partial<Run> & { startedAt: string }): Run {
  return {
    id: 'run-x',
    projectId: 'proj-1',
    name: 'Test Run',
    suiteId: 'suite-1',
    suiteName: 'Authentication',
    cases: [],
    status: 'pass',
    passRate: 100,
    source: 'manual',
    ...overrides,
  }
}

function daysAgo(n: number, hour = 11): string {
  const d = new Date(NOW - n * 24 * 60 * 60 * 1000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

// ── toLocalDateString ───────────────────────────────────────────────────

describe('toLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date(2026, 5, 16, 11, 0, 0) // June 16, 2026 local
    expect(toLocalDateString(d)).toBe('2026-06-16')
  })

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 9, 0, 0) // Jan 5, 2026
    expect(toLocalDateString(d)).toBe('2026-01-05')
  })
})

// ── getLastRun ──────────────────────────────────────────────────────────

describe('getLastRun', () => {
  it('returns undefined when no runs exist', () => {
    expect(getLastRun([], 'suite-1')).toBeUndefined()
  })

  it('returns undefined when no runs match the suite', () => {
    const runs = [makeRun({ id: 'r1', startedAt: daysAgo(1), suiteId: 'suite-2' })]
    expect(getLastRun(runs, 'suite-1')).toBeUndefined()
  })

  it('returns the most recent run by startedAt', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(3) }),
      makeRun({ id: 'r2', startedAt: daysAgo(1) }),
      makeRun({ id: 'r3', startedAt: daysAgo(5) }),
    ]
    expect(getLastRun(runs, 'suite-1')?.id).toBe('r2')
  })

  it('ignores runs from other suites', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), suiteId: 'suite-1' }),
      makeRun({ id: 'r2', startedAt: daysAgo(0), suiteId: 'suite-2' }),
    ]
    expect(getLastRun(runs, 'suite-1')?.id).toBe('r1')
  })
})

// ── getPassRateLastNDays ────────────────────────────────────────────────

describe('getPassRateLastNDays', () => {
  it('returns 0 for empty runs', () => {
    expect(getPassRateLastNDays([], 'suite-1', 7, NOW)).toBe(0)
  })

  it('returns 100 when all runs in window are pass', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
    ]
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(100)
  })

  it('returns 0 when all runs in window are fail', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'fail' }),
    ]
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(0)
  })

  it('computes mixed pass/fail rates', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
      makeRun({ id: 'r3', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'fail' }),
      makeRun({ id: 'r4', startedAt: daysAgo(4), finishedAt: daysAgo(4), status: 'pass' }),
    ]
    // 3 of 4 pass = 75
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(75)
  })

  it('excludes runs outside the window', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(10), finishedAt: daysAgo(10), status: 'fail' }),
    ]
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(100)
  })

  it('excludes running and pending runs', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(2), status: 'running' }),
      makeRun({ id: 'r3', startedAt: daysAgo(3), status: 'pending' }),
    ]
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(100)
  })

  it('handles n=0 edge case (only runs at exactly now)', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: NOW_ISO, finishedAt: NOW_ISO, status: 'pass' }),
    ]
    // n=0 → window [now, now] inclusive → counts the run
    expect(getPassRateLastNDays(runs, 'suite-1', 0, NOW)).toBe(100)
  })

  it('rounds half values', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
      makeRun({ id: 'r3', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'fail' }),
    ]
    // 2/3 = 66.67 → 67
    expect(getPassRateLastNDays(runs, 'suite-1', 7, NOW)).toBe(67)
  })
})

// ── getSparklineData ────────────────────────────────────────────────────

describe('getSparklineData', () => {
  it('returns 7 zero entries when no runs', () => {
    const data = getSparklineData([], 'suite-1', NOW)
    expect(data).toHaveLength(7)
    expect(data.every((d) => d.passRate === 0 && d.runCount === 0)).toBe(true)
  })

  it('returns entries oldest first', () => {
    const data = getSparklineData([], 'suite-1', NOW)
    // First date should be 6 days before the last
    const first = new Date(data[0].date)
    const last = new Date(data[6].date)
    const diff = (last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)
    expect(diff).toBe(6)
  })

  it('zero-fills days with no runs', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(0), finishedAt: daysAgo(0), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'fail' }),
    ]
    const data = getSparklineData(runs, 'suite-1', NOW)
    expect(data).toHaveLength(7)
    // Day 6 (today): 1 pass / 1 completed = 100
    expect(data[6].passRate).toBe(100)
    expect(data[6].runCount).toBe(1)
    // Day 3: 1 fail / 1 completed = 0
    expect(data[3].passRate).toBe(0)
    expect(data[3].runCount).toBe(1)
    // Other days: 0
    expect(data[0].passRate).toBe(0)
    expect(data[0].runCount).toBe(0)
  })

  it('counts pending/running runs in runCount but not passRate', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(1), status: 'running' }),
    ]
    const data = getSparklineData(runs, 'suite-1', NOW)
    const yesterday = data[5]
    expect(yesterday.runCount).toBe(2)
    expect(yesterday.passRate).toBe(100) // 1 pass / 1 completed
  })
})

// ── getSuiteRunStatus ───────────────────────────────────────────────────

describe('getSuiteRunStatus', () => {
  it('returns never-run for empty runs', () => {
    expect(getSuiteRunStatus([], 'suite-1', NOW)).toBe('never-run')
  })

  it('returns never-run when no runs match the suite', () => {
    const runs = [makeRun({ id: 'r1', startedAt: daysAgo(1), suiteId: 'suite-2' })]
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('never-run')
  })

  it('returns running when any run is running', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'fail' }),
      makeRun({ id: 'r2', startedAt: daysAgo(0), status: 'running' }),
    ]
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('running')
  })

  it('returns pass when last completed is pass and rate ≥ 70%', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
    ]
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('pass')
  })

  it('returns fail when last completed is fail and rate ≥ 70%', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(0), finishedAt: daysAgo(0), status: 'fail' }),
      makeRun({ id: 'r2', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r3', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
      makeRun({ id: 'r4', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'pass' }),
    ]
    // 3/4 = 75%, last is fail → 'fail' (rate ≥ 70 so threshold does not override)
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('fail')
  })

  it('returns needs-attention at 50% (below 70% threshold)', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(0), finishedAt: daysAgo(0), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r3', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'fail' }),
      makeRun({ id: 'r4', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'fail' }),
    ]
    // 2/4 = 50% < 70% → needs-attention
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('needs-attention')
  })

  it('returns pass at exactly 70% (threshold is strict <)', () => {
    const runs: Run[] = []
    for (let i = 0; i < 7; i++) {
      runs.push(makeRun({ id: `p${i}`, startedAt: daysAgo(i), finishedAt: daysAgo(i), status: 'pass' }))
    }
    for (let i = 7; i < 10; i++) {
      runs.push(makeRun({ id: `f${i}`, startedAt: daysAgo(i), finishedAt: daysAgo(i), status: 'fail' }))
    }
    // 7/10 = 70% → pass (not < 70)
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('pass')
  })

  it('returns needs-attention when only pending runs exist (no completed)', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(0), status: 'pending' }),
    ]
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('needs-attention')
  })

  it('returns needs-attention when runs exist but none in last 7 days', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(10), finishedAt: daysAgo(10), status: 'pass' }),
    ]
    // No runs in 7d window → rate = 0 → needs-attention
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('needs-attention')
  })

  it('uses last completed when there are runs in window and last is pass', () => {
    const runs = [
      makeRun({ id: 'r1', startedAt: daysAgo(0), finishedAt: daysAgo(0), status: 'pass' }),
      makeRun({ id: 'r2', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r3', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
    ]
    expect(getSuiteRunStatus(runs, 'suite-1', NOW)).toBe('pass')
  })
})

// ── aggregateForProject ─────────────────────────────────────────────────

describe('aggregateForProject', () => {
  const suites: Suite[] = [
    {
      id: 'suite-1',
      projectId: 'proj-1',
      organizationId: 'org-1',
      name: 'A',
      cases: [
        { id: 'tc-1', suiteId: 'suite-1', name: 'a', steps: [], expectedResult: '', priority: 'low', state: 'active' },
        { id: 'tc-2', suiteId: 'suite-1', name: 'b', steps: [], expectedResult: '', priority: 'low', state: 'active' },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      description: '',
      tags: [],
      isDefault: false,
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'suite-2',
      projectId: 'proj-1',
      organizationId: 'org-1',
      name: 'B',
      cases: [
        { id: 'tc-3', suiteId: 'suite-2', name: 'c', steps: [], expectedResult: '', priority: 'low', state: 'active' },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      description: '',
      tags: [],
      isDefault: false,
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]

  it('returns zeros and no lastRunAt for empty project', () => {
    const m = aggregateForProject([], suites, NOW)
    expect(m.totalSuites).toBe(2)
    expect(m.totalCases).toBe(3)
    expect(m.passRate7d).toBe(0)
    expect(m.lastRunAt).toBeUndefined()
  })

  it('sums cases across all suites', () => {
    const m = aggregateForProject([], suites, NOW)
    expect(m.totalCases).toBe(3)
  })

  it('computes project-wide pass rate over 7d', () => {
    const runs = [
      makeRun({ id: 'r1', suiteId: 'suite-1', startedAt: daysAgo(1), finishedAt: daysAgo(1), status: 'pass' }),
      makeRun({ id: 'r2', suiteId: 'suite-1', startedAt: daysAgo(2), finishedAt: daysAgo(2), status: 'pass' }),
      makeRun({ id: 'r3', suiteId: 'suite-2', startedAt: daysAgo(3), finishedAt: daysAgo(3), status: 'fail' }),
    ]
    const m = aggregateForProject(runs, suites, NOW)
    expect(m.passRate7d).toBe(67) // 2/3
  })

  it('returns the most recent run timestamp across all suites', () => {
    const runs = [
      makeRun({ id: 'r1', suiteId: 'suite-1', startedAt: daysAgo(2) }),
      makeRun({ id: 'r2', suiteId: 'suite-2', startedAt: daysAgo(1) }),
    ]
    const m = aggregateForProject(runs, suites, NOW)
    expect(m.lastRunAt).toBe(daysAgo(1))
  })

  it('ignores runs from other projects (not in suites set)', () => {
    const runs = [
      makeRun({ id: 'r1', suiteId: 'suite-other', startedAt: daysAgo(1), status: 'pass' }),
    ]
    const m = aggregateForProject(runs, suites, NOW)
    expect(m.passRate7d).toBe(0)
    expect(m.lastRunAt).toBeUndefined()
  })
})
