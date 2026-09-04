import { describe, it, expect } from 'vitest'
import type { TraceabilityCalendarRecord } from '@qably/types'
import {
  buildTraceabilityGrid,
  computeLevelThresholds,
  weekdayNames,
} from '@/features/dashboard/lib/traceability-grid'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function record(
  days: TraceabilityCalendarRecord['days'] = [],
): TraceabilityCalendarRecord {
  const totals = days.reduce(
    (acc, day) => ({
      scm: acc.scm + day.scm,
      proposals: acc.proposals + day.proposals,
      official: acc.official + day.official,
      runs: acc.runs + day.runs,
    }),
    { scm: 0, proposals: 0, official: 0, runs: 0 },
  )

  return { year: 2026, timeZone: 'America/Guatemala', totals, days }
}

function day(
  date: string,
  counts: Partial<Record<'scm' | 'proposals' | 'official' | 'runs', number>> = {},
) {
  return { date, scm: 0, proposals: 0, official: 0, runs: 0, ...counts }
}

function cellFor(
  grid: ReturnType<typeof buildTraceabilityGrid>,
  date: string,
) {
  return grid.weeks
    .flatMap((week) => week.days)
    .find((cell) => cell?.date === date)
}

describe('computeLevelThresholds', () => {
  it('ignores empty days so the scale describes real activity', () => {
    expect(computeLevelThresholds([0, 0, 0, 0])).toEqual([1, 1, 1])
  })

  it('spreads the levels across the quartiles of the non-empty days', () => {
    const thresholds = computeLevelThresholds([1, 2, 3, 4, 5, 6, 7, 8])

    expect(thresholds[0]).toBeLessThan(thresholds[2])
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
  })

  it('does not sink a uniformly busy year to the faintest level', () => {
    const grid = buildTraceabilityGrid(
      record(
        Array.from({ length: 40 }, (_, index) =>
          day(`2026-02-${String(index + 1).padStart(2, '0')}`, { runs: 214 }),
        ).slice(0, 28),
      ),
      'all',
      MONTHS,
    )

    const active = grid.weeks
      .flatMap((week) => week.days)
      .filter((cell) => cell !== null && cell.count > 0)

    expect(active.length).toBeGreaterThan(0)
    expect(active.every((cell) => cell?.level === 3)).toBe(true)
  })

  it('still separates levels as soon as the days differ', () => {
    const grid = buildTraceabilityGrid(
      record([
        day('2026-02-01', { runs: 1 }),
        day('2026-02-02', { runs: 50 }),
        day('2026-02-03', { runs: 400 }),
      ]),
      'all',
      MONTHS,
    )

    const levels = grid.weeks
      .flatMap((week) => week.days)
      .filter((cell) => cell !== null && cell.count > 0)
      .map((cell) => cell?.level)

    expect(new Set(levels).size).toBeGreaterThan(1)
  })

  it('keeps a busy day at the top level regardless of the volume', () => {
    const counts = [1, 2, 3, 400]
    const thresholds = computeLevelThresholds(counts)

    expect(400).toBeGreaterThan(thresholds[2])
  })
})

describe('buildTraceabilityGrid', () => {
  it('reports the total for the active filter', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { scm: 2, official: 5, runs: 214 })]),
      'all',
      MONTHS,
    )

    expect(grid.totalEvents).toBe(221)
  })

  it('narrows the total to one stage when a stage is selected', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { scm: 2, official: 5, runs: 214 })]),
      'runs',
      MONTHS,
    )

    expect(grid.totalEvents).toBe(214)
  })

  it('carries the server totals through as the per-stage breakdown', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { scm: 2, official: 5, runs: 214 })]),
      'all',
      MONTHS,
    )

    expect(grid.breakdownTotals).toEqual({
      scm: 2,
      proposals: 0,
      official: 5,
      runs: 214,
    })
  })

  it('places a day on its real calendar date', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { runs: 3 })]),
      'all',
      MONTHS,
    )
    const cell = cellFor(grid, '2026-06-16')

    expect(cell?.count).toBe(3)
    expect(cell?.dayOfWeek).toBe(new Date(2026, 5, 16).getDay())
  })

  it('fills days the server omitted with zero rather than leaving holes', () => {
    const grid = buildTraceabilityGrid(record(), 'all', MONTHS)
    const cells = grid.weeks.flatMap((week) => week.days).filter(Boolean)

    expect(cells).toHaveLength(365)
    expect(cells.every((cell) => cell?.count === 0)).toBe(true)
  })

  it('covers a leap year', () => {
    const leap: TraceabilityCalendarRecord = { ...record(), year: 2028 }
    const grid = buildTraceabilityGrid(leap, 'all', MONTHS)
    const cells = grid.weeks.flatMap((week) => week.days).filter(Boolean)

    expect(cells).toHaveLength(366)
  })

  it('pads the first and last weeks with nulls instead of foreign days', () => {
    const grid = buildTraceabilityGrid(record(), 'all', MONTHS)

    expect(grid.weeks[0].days).toHaveLength(7)
    expect(grid.weeks[grid.weeks.length - 1].days).toHaveLength(7)
    expect(
      grid.weeks.flatMap((w) => w.days).some((cell) => cell === null),
    ).toBe(true)
  })

  it('labels every month once', () => {
    const grid = buildTraceabilityGrid(record(), 'all', MONTHS)

    expect(grid.monthLabels).toHaveLength(12)
    expect(grid.monthLabels.map((label) => label.name)).toEqual([...MONTHS])
  })

  it('keeps the per-stage breakdown on each day for the tooltip', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { scm: 2, official: 5, runs: 214 })]),
      'all',
      MONTHS,
    )

    expect(cellFor(grid, '2026-06-16')?.breakdown).toEqual({
      scm: 2,
      proposals: 0,
      official: 5,
      runs: 214,
    })
  })

  it('counts only the selected stage on each day when a stage is selected', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { scm: 2, official: 5, runs: 214 })]),
      'scm',
      MONTHS,
    )

    expect(cellFor(grid, '2026-06-16')?.count).toBe(2)
  })

  it('gives the busiest day the top level and an empty day level zero', () => {
    const grid = buildTraceabilityGrid(
      record([
        day('2026-06-15', { runs: 1 }),
        day('2026-06-16', { runs: 500 }),
      ]),
      'all',
      MONTHS,
    )

    expect(cellFor(grid, '2026-06-16')?.level).toBe(4)
    expect(cellFor(grid, '2026-06-14')?.level).toBe(0)
  })

  it('never invents activity for a day the server did not report', () => {
    const grid = buildTraceabilityGrid(
      record([day('2026-06-16', { runs: 3 })]),
      'all',
      MONTHS,
    )
    const active = grid.weeks
      .flatMap((week) => week.days)
      .filter((cell) => cell !== null && cell.count > 0)

    expect(active).toHaveLength(1)
  })
})

describe('weekdayNames', () => {
  it('starts on Sunday to match the grid rows', () => {
    expect(weekdayNames('en')[0].toLowerCase()).toContain('sun')
    expect(weekdayNames('es')[0].toLowerCase()).toContain('dom')
  })

  it('returns one name per weekday in the active locale', () => {
    expect(weekdayNames('es')).toHaveLength(7)
    expect(weekdayNames('en')).toHaveLength(7)
    expect(weekdayNames('es')).not.toEqual(weekdayNames('en'))
  })
})
