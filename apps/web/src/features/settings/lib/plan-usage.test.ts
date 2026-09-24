import { describe, expect, it } from 'vitest'
import { formatCreditsReset, usagePercent } from './plan-usage'

describe('usagePercent', () => {
  it('computes the used fraction as a whole percentage', () => {
    expect(usagePercent(2, 10)).toBe(20)
  })

  it('clamps at 100 when usage meets or exceeds the limit', () => {
    expect(usagePercent(10, 10)).toBe(100)
    expect(usagePercent(12, 10)).toBe(100)
  })

  it('returns null for an unlimited plan (null limit)', () => {
    expect(usagePercent(3, null)).toBeNull()
  })
})

describe('formatCreditsReset', () => {
  it('formats the UTC reset date in English', () => {
    expect(formatCreditsReset('2026-10-01T00:00:00.000Z', 'en')).toBe('October 1, 2026')
  })

  it('formats the UTC reset date in Spanish', () => {
    expect(formatCreditsReset('2026-10-01T00:00:00.000Z', 'es')).toBe('1 de octubre de 2026')
  })
})
