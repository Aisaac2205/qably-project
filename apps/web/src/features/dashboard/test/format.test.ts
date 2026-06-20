import { describe, it, expect } from 'vitest'
import {
  formatRelativeTime,
  formatPassRate,
  formatNumber,
} from '@/features/dashboard/lib/format'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-19T12:00:00Z').getTime()

  it('returns "just now" for less than 1 minute', () => {
    expect(formatRelativeTime('2026-06-19T11:59:50Z', now)).toBe('just now')
  })

  it('returns "5m ago" for 5 minutes', () => {
    expect(formatRelativeTime('2026-06-19T11:55:00Z', now)).toBe('5m ago')
  })

  it('returns "1h ago" for 1 hour', () => {
    expect(formatRelativeTime('2026-06-19T11:00:00Z', now)).toBe('1h ago')
  })

  it('returns "2h ago" for 2 hours', () => {
    expect(formatRelativeTime('2026-06-19T10:00:00Z', now)).toBe('2h ago')
  })

  it('returns "1d ago" for 1 day', () => {
    expect(formatRelativeTime('2026-06-18T12:00:00Z', now)).toBe('1d ago')
  })

  it('returns "3d ago" for 3 days', () => {
    expect(formatRelativeTime('2026-06-16T12:00:00Z', now)).toBe('3d ago')
  })

  it('returns full date for more than 30 days', () => {
    const result = formatRelativeTime('2026-05-01T12:00:00Z', now)
    expect(result).toContain('2026')
    expect(result).not.toBe('just now')
  })

  it('handles future dates', () => {
    expect(formatRelativeTime('2026-06-19T12:05:00Z', now)).toBe('just now')
  })

  it('works without explicit now parameter', () => {
    const result = formatRelativeTime('2020-01-01T00:00:00Z')
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
