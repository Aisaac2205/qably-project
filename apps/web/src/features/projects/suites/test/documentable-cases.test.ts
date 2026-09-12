import { describe, expect, it } from 'vitest'
import { localeNameKey } from '../lib/documentable-cases'

describe('localeNameKey', () => {
  it('maps the two supported locales and falls back for anything else', () => {
    expect(localeNameKey('es')).toBe('suites.localeNameEs')
    expect(localeNameKey('en')).toBe('suites.localeNameEn')
    expect(localeNameKey('pt')).toBe('suites.localeNameOther')
  })
})
