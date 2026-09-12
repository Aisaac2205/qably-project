import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_LOCALE, matchLocale, useI18nStore } from '@/lib/i18n/store'

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

describe('t pluralization', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('picks the singular form when count is one', () => {
    const { t } = useI18nStore.getState()

    expect(t('suites.documentFilesPending', { count: 1 })).toBe(
      '1 automated case is not documented yet.',
    )
  })

  it('picks the plural form for any other count', () => {
    const { t } = useI18nStore.getState()

    expect(t('suites.documentFilesPending', { count: 4 })).toBe(
      '4 automated cases are not documented yet.',
    )
    expect(t('suites.documentFilesPending', { count: 0 })).toBe(
      '0 automated cases are not documented yet.',
    )
  })

  it('leaves keys without plural forms untouched', () => {
    const { t } = useI18nStore.getState()

    expect(t('suites.documentFilesError')).not.toBe('suites.documentFilesError')
  })

  it('still resolves a key whose plural suffix the caller wrote by hand', () => {
    const { t } = useI18nStore.getState()

    expect(t('suites.case_one')).toBe('case')
    expect(t('suites.case_other')).toBe('cases')
  })
})
