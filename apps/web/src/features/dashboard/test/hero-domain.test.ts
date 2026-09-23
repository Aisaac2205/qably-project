import { describe, expect, it } from 'vitest'
import type { DailyPoint } from '@qably/types'
import {
  HERO_PASS_RATE_DOMAIN,
  HERO_PASS_RATE_TICKS,
  buildHeroPoints,
  resolveHeroPassRateDomain,
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
})

describe('resolveHeroPassRateDomain', () => {
  it('pins the default domain/ticks constants to 80-100 with five ticks', () => {
    expect(HERO_PASS_RATE_DOMAIN).toEqual([80, 100])
    expect(HERO_PASS_RATE_TICKS).toEqual([80, 85, 90, 95, 100])
  })

  it('defaults to the 80-100 domain with five ticks when every value is 80 or above', () => {
    const points = [
      { id: 'd1', label: 'Mon', current: 92, previous: 88, runs: 1, failedRuns: 0 },
      { id: 'd2', label: 'Tue', current: 100, previous: 82, runs: 1, failedRuns: 0 },
    ]

    expect(resolveHeroPassRateDomain(points)).toEqual({
      domain: [80, 100],
      ticks: [80, 85, 90, 95, 100],
    })
  })

  it('defaults to 80-100 when there is no data at all', () => {
    expect(resolveHeroPassRateDomain([])).toEqual({
      domain: [80, 100],
      ticks: [80, 85, 90, 95, 100],
    })
  })

  it('ignores null current/previous values when finding the minimum', () => {
    const points = [
      { id: 'd1', label: 'Mon', current: null, previous: null, runs: 0, failedRuns: 0 },
      { id: 'd2', label: 'Tue', current: 90, previous: 85, runs: 1, failedRuns: 0 },
    ]

    expect(resolveHeroPassRateDomain(points)).toEqual({
      domain: [80, 100],
      ticks: [80, 85, 90, 95, 100],
    })
  })

  it('widens the domain floor in 20-point steps so the lowest tick still covers a below-80 value', () => {
    const points = [
      { id: 'd1', label: 'Mon', current: 72, previous: 88, runs: 1, failedRuns: 0 },
    ]

    expect(resolveHeroPassRateDomain(points)).toEqual({
      domain: [60, 100],
      ticks: [60, 70, 80, 90, 100],
    })
  })

  it('widens further for a much lower value', () => {
    const points = [
      { id: 'd1', label: 'Mon', current: 52, previous: 88, runs: 1, failedRuns: 0 },
    ]

    expect(resolveHeroPassRateDomain(points)).toEqual({
      domain: [40, 100],
      ticks: [40, 55, 70, 85, 100],
    })
  })
})
