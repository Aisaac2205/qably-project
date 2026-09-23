import { describe, expect, it } from 'vitest'
import type { DailyPoint } from '@qably/types'
import {
  buildExecutedCasesPoints,
  resolveExecutedCasesTrend,
  resolvePeriodRangeLabel,
} from '@/features/dashboard/lib/executed-cases-domain'

function day(overrides: Partial<DailyPoint> = {}): DailyPoint {
  return {
    date: '2026-06-16',
    passRate: 0.8,
    runs: 4,
    failedRuns: 1,
    executed: 10,
    passed: 8,
    failed: 1,
    blocked: 1,
    ...overrides,
  }
}

describe('buildExecutedCasesPoints', () => {
  it('pairs current and previous points by index into raw executed counts', () => {
    const points = buildExecutedCasesPoints(
      [day({ date: '2026-06-16', executed: 12, passed: 10, failed: 1, blocked: 1 })],
      [day({ date: '2026-05-17', executed: 8, passed: 7, failed: 1, blocked: 0 })],
      (date) => date,
    )

    expect(points).toEqual([
      {
        id: '2026-06-16',
        label: '2026-06-16',
        current: 12,
        previous: 8,
        passed: 10,
        failed: 1,
        blocked: 1,
      },
    ])
  })

  it('reports a real zero, never null, for a day with no runs', () => {
    const points = buildExecutedCasesPoints(
      [day({ executed: 0, passed: 0, failed: 0, blocked: 0 })],
      [day({ executed: 6 })],
      (date) => date,
    )

    expect(points[0].current).toBe(0)
    expect(points[0].previous).toBe(6)
  })

  it('falls back to the previous window date when the current window is shorter, with a zero current', () => {
    const points = buildExecutedCasesPoints(
      [],
      [day({ date: '2026-05-17', executed: 4 })],
      (date) => date,
    )

    expect(points).toEqual([
      {
        id: '2026-05-17',
        label: '2026-05-17',
        current: 0,
        previous: 4,
        passed: 0,
        failed: 0,
        blocked: 0,
      },
    ])
  })

  it('applies the caller-supplied label formatter', () => {
    const points = buildExecutedCasesPoints(
      [day({ date: '2026-06-16' })],
      [day({ date: '2026-05-17' })],
      (date) => `formatted:${date}`,
    )

    expect(points[0].label).toBe('formatted:2026-06-16')
  })

  it('returns no points for two empty windows', () => {
    expect(buildExecutedCasesPoints([], [], (date) => date)).toEqual([])
  })
})

describe('resolveExecutedCasesTrend', () => {
  it('reports an up direction with a rounded percent increase', () => {
    const trend = resolveExecutedCasesTrend([{ current: 150, previous: 100 }])

    expect(trend).toEqual({ direction: 'up', percent: 50, currentTotal: 150, previousTotal: 100 })
  })

  it('reports a down direction with a rounded percent decrease', () => {
    const trend = resolveExecutedCasesTrend([{ current: 40, previous: 100 }])

    expect(trend).toEqual({ direction: 'down', percent: 60, currentTotal: 40, previousTotal: 100 })
  })

  it('reports an equal direction with a zero percent when totals match', () => {
    const trend = resolveExecutedCasesTrend([{ current: 80, previous: 80 }])

    expect(trend).toEqual({ direction: 'equal', percent: 0, currentTotal: 80, previousTotal: 80 })
  })

  it('omits a percent (null) when the previous period total is zero, but still reports up when current has cases', () => {
    const trend = resolveExecutedCasesTrend([{ current: 20, previous: 0 }])

    expect(trend).toEqual({ direction: 'up', percent: null, currentTotal: 20, previousTotal: 0 })
  })

  it('reports equal with a null percent when both totals are zero', () => {
    const trend = resolveExecutedCasesTrend([])

    expect(trend).toEqual({ direction: 'equal', percent: null, currentTotal: 0, previousTotal: 0 })
  })
})

describe('resolvePeriodRangeLabel', () => {
  it('formats a range between the first and last point', () => {
    const points = [
      { id: '2026-06-01', label: 'Jun 1', current: 1, previous: 1, passed: 1, failed: 0, blocked: 0 },
      { id: '2026-06-30', label: 'Jun 30', current: 1, previous: 1, passed: 1, failed: 0, blocked: 0 },
    ]

    expect(resolvePeriodRangeLabel(points, (date) => date)).toBe('2026-06-01 – 2026-06-30')
  })

  it('formats a single date when there is only one point', () => {
    const points = [
      { id: '2026-06-01', label: 'Jun 1', current: 1, previous: 1, passed: 1, failed: 0, blocked: 0 },
    ]

    expect(resolvePeriodRangeLabel(points, (date) => date)).toBe('2026-06-01')
  })

  it('returns null for no points', () => {
    expect(resolvePeriodRangeLabel([], (date) => date)).toBeNull()
  })
})
