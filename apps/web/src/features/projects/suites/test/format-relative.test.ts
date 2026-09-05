import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

const DAY_MS = 86400000

describe('formatRelative', () => {
  it('returns the given fallback when there is no timestamp', () => {
    expect(formatRelative(undefined, 'es', 'Nunca')).toBe('Nunca')
    expect(formatRelative(undefined, 'en', 'Never')).toBe('Never')
  })

  it('returns the given fallback instead of throwing on an invalid ISO string', () => {
    expect(formatRelative('not-a-real-date', 'en', 'Never')).toBe('Never')
    expect(() => formatRelative('not-a-real-date', 'en', 'Never')).not.toThrow()
  })

  it('formats in the locale it is given, not a hardcoded one', () => {
    const yesterday = new Date(Date.now() - DAY_MS).toISOString()

    expect(formatRelative(yesterday, 'es', 'Nunca')).toBe('ayer')
    expect(formatRelative(yesterday, 'en', 'Never')).toBe('yesterday')
  })

  it('formats hours within the same day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString()

    expect(formatRelative(threeHoursAgo, 'en', 'Never')).toBe('3 hours ago')
  })

  describe('with a fixed clock', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-03T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('counts calendar months crossed, not fixed 30-day buckets', () => {
      const jan31 = '2026-01-31T00:00:00.000Z'

      expect(formatRelative(jan31, 'en', 'Never')).toBe('2 months ago')
    })

    it('counts calendar years using the year field, not a fixed 365-day divisor', () => {
      const threeYearsAgo = '2023-03-03T00:00:00.000Z'

      expect(formatRelative(threeYearsAgo, 'en', 'Never')).toBe('3 years ago')
    })
  })
})
