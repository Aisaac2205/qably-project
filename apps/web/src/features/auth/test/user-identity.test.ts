import { describe, expect, it } from 'vitest'
import { initialsFrom } from '../lib/user-identity'

describe('initialsFrom', () => {
  it('takes the first letter of the first and last word', () => {
    expect(initialsFrom('Isaac Flores')).toBe('IF')
  })

  it('skips the middle names so a long legal name still yields two letters', () => {
    expect(initialsFrom('Ana María Gómez Ruiz')).toBe('AR')
  })

  it('falls back to the first two letters of a single-word name', () => {
    expect(initialsFrom('aisaac2205')).toBe('AI')
  })

  it('keeps a single letter when the name is one character', () => {
    expect(initialsFrom('A')).toBe('A')
  })

  it('ignores surrounding and repeated whitespace', () => {
    expect(initialsFrom('  Isaac   Flores  ')).toBe('IF')
  })

  it('preserves accented initials rather than stripping them', () => {
    expect(initialsFrom('Ángel Ñuñez')).toBe('ÁÑ')
  })

  it('returns an empty string for an empty name, so the caller can decide what to render', () => {
    expect(initialsFrom('')).toBe('')
    expect(initialsFrom('   ')).toBe('')
  })
})
