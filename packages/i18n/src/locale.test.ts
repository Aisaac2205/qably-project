import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  parseAcceptLanguage,
  resolveLocale,
  resolveNotificationEventKey,
} from './index'

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

describe('resolveNotificationEventKey', () => {
  it('leaves non connection_security events untouched', () => {
    expect(resolveNotificationEventKey('run_failed', {})).toBe('run_failed')
  })

  it('maps a known action code to its per-action key', () => {
    expect(
      resolveNotificationEventKey('connection_security', { action: 'created' }),
    ).toBe('connection_security_created')
    expect(
      resolveNotificationEventKey('connection_security', { action: 'rotated' }),
    ).toBe('connection_security_rotated')
    expect(
      resolveNotificationEventKey('connection_security', { action: 'removed' }),
    ).toBe('connection_security_removed')
  })

  it('maps a legacy English phrase to its action code', () => {
    expect(
      resolveNotificationEventKey('connection_security', { action: 'Created' }),
    ).toBe('connection_security_created')
    expect(
      resolveNotificationEventKey('connection_security', {
        action: 'Rotated the webhook secret',
      }),
    ).toBe('connection_security_rotated')
    expect(
      resolveNotificationEventKey('connection_security', { action: 'Removed' }),
    ).toBe('connection_security_removed')
  })

  it('falls back to the generic event key for an unknown action value', () => {
    expect(
      resolveNotificationEventKey('connection_security', {
        action: 'Webhook secret rotated',
      }),
    ).toBe('connection_security')
  })
})
