import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, matchLocale } from '@/lib/i18n/store'

describe('matchLocale', () => {
  it('matches an exact supported tag', () => {
    expect(matchLocale(['es'])).toBe('es')
  })

  it('matches a regional tag by its base language', () => {
    expect(matchLocale(['es-419'])).toBe('es')
    expect(matchLocale(['en-GB'])).toBe('en')
  })

  it('is case insensitive', () => {
    expect(matchLocale(['ES-AR'])).toBe('es')
  })

  it('honours preference order and skips unsupported tags', () => {
    expect(matchLocale(['pt-BR', 'fr', 'es-AR', 'en'])).toBe('es')
  })

  it('falls back to the default when nothing is supported', () => {
    expect(matchLocale(['pt-BR', 'fr'])).toBe(DEFAULT_LOCALE)
  })

  it('falls back to the default for an empty list', () => {
    expect(matchLocale([])).toBe(DEFAULT_LOCALE)
  })
})
