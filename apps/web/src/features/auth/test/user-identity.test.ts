import { describe, expect, it } from 'vitest'
import { initialsFrom, normalizeAvatarUrl } from '../lib/user-identity'

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

describe('normalizeAvatarUrl', () => {
  it('drops the cache-busting query GitHub appends, which the image allowlist rejects', () => {
    expect(
      normalizeAvatarUrl('https://avatars.githubusercontent.com/u/125110182?v=4'),
    ).toBe('https://avatars.githubusercontent.com/u/125110182')
  })

  it('drops any future version of that query, not just v=4', () => {
    expect(
      normalizeAvatarUrl('https://avatars.githubusercontent.com/u/1?v=9&s=80'),
    ).toBe('https://avatars.githubusercontent.com/u/1')
  })

  it('leaves a GitHub avatar without a query untouched', () => {
    expect(normalizeAvatarUrl('https://avatars.githubusercontent.com/u/1')).toBe(
      'https://avatars.githubusercontent.com/u/1',
    )
  })

  it('leaves another host untouched, because its query may be a signature', () => {
    expect(normalizeAvatarUrl('https://cdn.example.com/a.png?sig=abc')).toBe(
      'https://cdn.example.com/a.png?sig=abc',
    )
  })

  it('passes a malformed value through rather than throwing', () => {
    expect(normalizeAvatarUrl('not a url')).toBe('not a url')
  })

  it('returns null for no image', () => {
    expect(normalizeAvatarUrl(null)).toBeNull()
  })
})
