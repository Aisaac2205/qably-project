import { describe, it, expect } from 'vitest'
import { validateTags } from '@/lib/tag-validation'

describe('validateTags', () => {
  it('returns empty array for empty input', () => {
    expect(validateTags([])).toEqual([])
  })

  it('returns empty array when all entries are blank', () => {
    expect(validateTags(['', '   ', '\t'])).toEqual([])
  })

  it('accepts predefined tags as-is', () => {
    expect(validateTags(['smoke', 'regression', 'e2e'])).toEqual(['smoke', 'regression', 'e2e'])
  })

  it('normalizes uppercase to lowercase', () => {
    expect(validateTags(['SMOKE', 'Api'])).toEqual(['smoke', 'api'])
  })

  it('trims whitespace around tags', () => {
    expect(validateTags(['  smoke  ', '\tregression\n'])).toEqual(['smoke', 'regression'])
  })

  it('deduplicates case-insensitively', () => {
    expect(validateTags(['auth', 'AUTH', 'Auth'])).toEqual(['auth'])
  })

  it('rejects tags with spaces', () => {
    expect(validateTags(['auth login', 'smoke'])).toEqual(['smoke'])
  })

  it('allows hyphens', () => {
    expect(validateTags(['end-to-end', 'pre-prod'])).toEqual(['end-to-end', 'pre-prod'])
  })

  it('throws when a tag exceeds 32 characters', () => {
    const long = 'a'.repeat(33)
    expect(() => validateTags([long])).toThrow(RangeError)
    expect(() => validateTags([long])).toThrow(/32 characters/)
  })

  it('accepts a tag of exactly 32 characters', () => {
    const exactly32 = 'a'.repeat(32)
    expect(validateTags([exactly32])).toEqual([exactly32])
  })

  it('caps at 8 tags and drops the rest in order', () => {
    const nine = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']
    expect(validateTags(nine)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'])
  })

  it('combines normalization, dedup and order preservation', () => {
    expect(validateTags(['  SMOKE ', 'regression', 'smoke', 'e2e', 'E2E'])).toEqual([
      'smoke',
      'regression',
      'e2e',
    ])
  })
})
