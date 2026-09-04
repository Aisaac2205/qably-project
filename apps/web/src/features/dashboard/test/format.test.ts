import { describe, it, expect } from 'vitest'
import {
  formatRelativeTime,
  formatPassRate,
  formatNumber,
  formatEventCount,
} from '@/features/dashboard/lib/format'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-19T12:00:00Z').getTime()

  describe('in English', () => {
    it('returns "just now" for less than 1 minute', () => {
      expect(formatRelativeTime('2026-06-19T11:59:50Z', 'en', now)).toBe('just now')
    })

    it('returns compact minute, hour and day forms', () => {
      expect(formatRelativeTime('2026-06-19T11:55:00Z', 'en', now)).toBe('5m ago')
      expect(formatRelativeTime('2026-06-19T11:00:00Z', 'en', now)).toBe('1h ago')
      expect(formatRelativeTime('2026-06-19T10:00:00Z', 'en', now)).toBe('2h ago')
      expect(formatRelativeTime('2026-06-18T12:00:00Z', 'en', now)).toBe('1d ago')
      expect(formatRelativeTime('2026-06-16T12:00:00Z', 'en', now)).toBe('3d ago')
    })

    it('returns a full date beyond 30 days', () => {
      const result = formatRelativeTime('2026-05-01T12:00:00Z', 'en', now)
      expect(result).toContain('2026')
      expect(result).not.toBe('just now')
    })

    it('treats future dates as just now', () => {
      expect(formatRelativeTime('2026-06-19T12:05:00Z', 'en', now)).toBe('just now')
    })
  })

  describe('in Spanish', () => {
    it('never leaks English wording into the Spanish UI', () => {
      expect(formatRelativeTime('2026-06-19T11:59:50Z', 'es', now)).toBe('ahora')
      expect(formatRelativeTime('2026-06-19T11:55:00Z', 'es', now)).toBe('hace 5 min')
      expect(formatRelativeTime('2026-06-19T11:00:00Z', 'es', now)).toBe('hace 1 h')
      expect(formatRelativeTime('2026-06-18T12:00:00Z', 'es', now)).toBe('hace 1 d')
      expect(formatRelativeTime('2026-06-16T12:00:00Z', 'es', now)).toBe('hace 3 d')
    })

    it('returns a Spanish full date beyond 30 days', () => {
      const result = formatRelativeTime('2026-05-01T12:00:00Z', 'es', now)
      expect(result).toContain('2026')
      expect(result).not.toMatch(/ago|just now/i)
    })
  })

  it('works without an explicit now parameter', () => {
    const result = formatRelativeTime('2020-01-01T00:00:00Z', 'en')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatPassRate', () => {
  it('returns percentage string', () => {
    expect(formatPassRate(75)).toBe('75%')
  })

  it('handles 0', () => {
    expect(formatPassRate(0)).toBe('0%')
  })

  it('handles 100', () => {
    expect(formatPassRate(100)).toBe('100%')
  })

  it('handles decimals by rounding', () => {
    expect(formatPassRate(75.6)).toBe('76%')
  })
})

describe('formatNumber', () => {
  it('formats number with locale separators', () => {
    const result = formatNumber(1234)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('handles 0', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('handles large numbers', () => {
    const result = formatNumber(1000000)
    expect(result.length).toBeGreaterThanOrEqual(7) // "1,000,000"
  })
})

describe('formatEventCount', () => {
  it('groups thousands with a dot in Spanish', () => {
    expect(formatEventCount(2226, 'es')).toBe('2.226')
  })

  it('groups thousands with a comma in English', () => {
    expect(formatEventCount(2226, 'en')).toBe('2,226')
  })

  it('leaves values below one thousand untouched', () => {
    expect(formatEventCount(930, 'es')).toBe('930')
    expect(formatEventCount(0, 'en')).toBe('0')
  })

  it('groups every three digits in long numbers', () => {
    expect(formatEventCount(1234567, 'en')).toBe('1,234,567')
  })

  it('does not depend on the runtime ICU data', () => {
    const withoutIntl = formatEventCount(1000, 'es')
    expect(withoutIntl).toBe('1.000')
  })
})
