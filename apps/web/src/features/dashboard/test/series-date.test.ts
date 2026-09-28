import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatSeriesDayLabel, formatSeriesRange, parseSeriesDate } from '@/features/dashboard/lib/series-date'

describe('parseSeriesDate', () => {
  it('parses a series date key as local midnight, not UTC', () => {
    const date = parseSeriesDate('2026-09-24')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(24)
    expect(date.getHours()).toBe(0)
  })

  describe('in a UTC-6 timezone', () => {
    const originalTZ = process.env.TZ

    beforeEach(() => {
      process.env.TZ = 'America/Guatemala'
    })

    afterEach(() => {
      process.env.TZ = originalTZ
    })

    it('never shifts the day back one when parsed and re-read locally', () => {
      const date = parseSeriesDate('2026-09-24')

      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth()).toBe(8)
      expect(date.getDate()).toBe(24)

      const utcDrifted = new Date('2026-09-24')
      expect(utcDrifted.getDate()).not.toBe(24)
    })

    it('agrees with the daily-activity chart’s previous ad-hoc parse (T00:00:00 local)', () => {
      const viaHelper = parseSeriesDate('2026-09-24')
      const viaLocalStringAppend = new Date('2026-09-24T00:00:00')

      expect(viaHelper.getTime()).toBe(viaLocalStringAppend.getTime())
    })
  })
})

describe('formatSeriesRange', () => {
  it('formats a daily bucket as a single short date', () => {
    const label = formatSeriesRange({ date: '2026-09-24', rangeEnd: '2026-09-24' }, 'day', 'es')
    expect(label).toBe('24 sept')
  })

  it('formats a weekly bucket as a range with an en dash, month on the end only when both days share a month', () => {
    const label = formatSeriesRange({ date: '2026-09-22', rangeEnd: '2026-09-28' }, 'week', 'es')
    expect(label).toBe('22–28 sept')
  })

  it('keeps the month on both ends when the week crosses a month boundary', () => {
    const label = formatSeriesRange({ date: '2026-09-29', rangeEnd: '2026-10-05' }, 'week', 'es')
    expect(label).toBe('29 sept–5 oct')
  })

  it('treats a weekly bucket whose range collapses to one day as a single date', () => {
    const label = formatSeriesRange({ date: '2026-09-24', rangeEnd: '2026-09-24' }, 'week', 'en')
    expect(label).toBe('Sep 24')
  })

  it('formats in English with the app locale set to en, same day-only-start rule as Spanish', () => {
    const label = formatSeriesRange({ date: '2026-09-22', rangeEnd: '2026-09-28' }, 'week', 'en')
    expect(label).toBe('22–Sep 28')
  })

  it('keeps the month on both ends in English when the week crosses a month boundary', () => {
    const label = formatSeriesRange({ date: '2026-09-29', rangeEnd: '2026-10-05' }, 'week', 'en')
    expect(label).toBe('Sep 29–Oct 5')
  })
})

describe('formatSeriesDayLabel', () => {
  it('formats a Date using the resolved date locale', () => {
    expect(formatSeriesDayLabel(new Date(2026, 8, 24), 'en')).toBe('Sep 24')
  })
})
