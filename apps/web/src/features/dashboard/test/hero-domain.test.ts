import { describe, expect, it } from 'vitest'
import type { DailyPoint } from '@qably/types'
import {
  HERO_PASS_RATE_DOMAIN,
  HERO_PASS_RATE_TICKS,
  buildHeroPoints,
} from '@/features/dashboard/lib/hero-domain'

function day(overrides: Partial<DailyPoint> = {}): DailyPoint {
  return { date: '2026-06-16', passRate: 0.8, runs: 4, failedRuns: 1, ...overrides }
}

describe('buildHeroPoints', () => {
  it('pairs current and previous points by index into a percent scale', () => {
    const points = buildHeroPoints(
      [day({ date: '2026-06-16', passRate: 0.8 })],
      [day({ date: '2026-05-17', passRate: 0.5 })],
      (date) => date,
    )

    expect(points).toEqual([
      {
        id: '2026-06-16',
        label: '2026-06-16',
        current: 80,
        previous: 50,
        runs: 4,
        failedRuns: 1,
      },
    ])
  })

  it('renders a gap instead of zero when a bucket has no runs', () => {
    const points = buildHeroPoints(
      [day({ passRate: null, runs: 0, failedRuns: 0 })],
      [day({ passRate: 0.6 })],
      (date) => date,
    )

    expect(points[0].current).toBeNull()
    expect(points[0].previous).toBe(60)
  })

  it('falls back to the previous window date when the current window is shorter', () => {
    const points = buildHeroPoints(
      [],
      [day({ date: '2026-05-17', passRate: 0.4 })],
      (date) => date,
    )

    expect(points).toEqual([
      {
        id: '2026-05-17',
        label: '2026-05-17',
        current: null,
        previous: 40,
        runs: undefined,
        failedRuns: undefined,
      },
    ])
  })

  it('applies the caller-supplied label formatter', () => {
    const points = buildHeroPoints(
      [day({ date: '2026-06-16' })],
      [day({ date: '2026-05-17' })],
      (date) => `formatted:${date}`,
    )

    expect(points[0].label).toBe('formatted:2026-06-16')
  })

  it('returns no points for two empty windows', () => {
    expect(buildHeroPoints([], [], (date) => date)).toEqual([])
  })

  it('pins the pass-rate domain to 0-100 with 0/50/100 ticks', () => {
    expect(HERO_PASS_RATE_DOMAIN).toEqual([0, 100])
    expect(HERO_PASS_RATE_TICKS).toEqual([0, 50, 100])
  })
})
