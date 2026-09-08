import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, parseAcceptLanguage, resolveLocale } from './index'

describe('resolveLocale', () => {
  it('accepts a plain supported locale', () => {
    expect(resolveLocale('es')).toBe('es')
    expect(resolveLocale('en')).toBe('en')
  })

  it('matches a regional tag by its primary subtag', () => {
    expect(resolveLocale('es-419')).toBe('es')
  })

  it('is case insensitive', () => {
    expect(resolveLocale('ES')).toBe('es')
  })

  it('parses an Accept-Language header list and honours q-values', () => {
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en')
  })

  it('falls back to the default locale for null, undefined, or empty candidates', () => {
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE)
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE)
  })

  it('tries each candidate in order until one resolves', () => {
    expect(resolveLocale(null, undefined, 'fr', 'es')).toBe('es')
  })

  it('falls back to the default when no candidate is supported', () => {
    expect(resolveLocale('fr', 'pt-BR')).toBe(DEFAULT_LOCALE)
  })
})

describe('parseAcceptLanguage', () => {
  it('returns tags ordered by descending q-value', () => {
    expect(parseAcceptLanguage('fr;q=0.5,en;q=0.9')).toEqual(['en', 'fr'])
  })

  it('treats a tag without a q-value as q=1', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toEqual(['en-US', 'en'])
  })

  it('returns an empty array for a missing header', () => {
    expect(parseAcceptLanguage(null)).toEqual([])
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })
})
