import { describe, it, expect } from 'vitest'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

const DAY_MS = 86400000

describe('formatRelative', () => {
  it('returns the given fallback when there is no timestamp', () => {
    expect(formatRelative(undefined, 'es', 'Nunca')).toBe('Nunca')
    expect(formatRelative(undefined, 'en', 'Never')).toBe('Never')
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
})
