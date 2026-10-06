import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en, es } from './index'

interface Tree {
  [key: string]: string | Tree
}

const LOCALES = { en: en as unknown as Tree, es: es as unknown as Tree }
const LOCALE_NAMES = Object.keys(LOCALES) as (keyof typeof LOCALES)[]
const PLURAL_SUFFIX = /_(one|other)$/
const UNICODE_ESCAPE = new RegExp(String.fromCharCode(92, 92) + 'u[0-9a-fA-F]{4}')

const PLAIN_KEYS = ['suites.loadMore', 'suites.loadingMore'] as const
const PLURAL_BASES = ['suites.loadedMoreSuites', 'suites.suitesShown'] as const
const REUSED_KEYS = [
  'common.retry',
  'suites.loadError',
  'suites.noSuitesMatch',
  'suites.clearFilters',
  'suites.noSuitesHeading',
  'suites.createSuiteHint',
] as const

function flatten(node: Tree, prefix = ''): Record<string, string> {
  return Object.entries(node).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) }
  }, {})
}

function listCopyKeys(locale: Tree): string[] {
  const bases = new Set<string>(PLURAL_BASES)

  return Object.keys(flatten(locale))
    .filter(
      (key) =>
        (PLAIN_KEYS as readonly string[]).includes(key) ||
        bases.has(key.replace(PLURAL_SUFFIX, '')),
    )
    .sort()
}

describe('suite list load more and announcement copy', () => {
  describe('locale parity', () => {
    it('ships the same new keys in en and es', () => {
      const expected = [
        'suites.loadMore',
        'suites.loadedMoreSuites_one',
        'suites.loadedMoreSuites_other',
        'suites.loadingMore',
        'suites.suitesShown_one',
        'suites.suitesShown_other',
      ]

      expect(listCopyKeys(LOCALES.en)).toEqual(expected)
      expect(listCopyKeys(LOCALES.es)).toEqual(expected)
    })

    it.each(LOCALE_NAMES)('never leaves a new text empty (%s)', (locale) => {
      const flat = flatten(LOCALES[locale])
      const keys = listCopyKeys(LOCALES[locale])

      expect(keys).toHaveLength(6)
      for (const key of keys) {
        expect(flat[key]?.trim()).not.toBe('')
        expect(flat[key]).toBeTypeOf('string')
      }
    })

    it('keeps the interpolation placeholders identical across locales', () => {
      const enFlat = flatten(LOCALES.en)
      const esFlat = flatten(LOCALES.es)
      const placeholders = (value: string) => (value.match(/\{\{[^}]*\}\}/g) ?? []).sort()

      for (const key of listCopyKeys(LOCALES.en)) {
        expect(placeholders(esFlat[key] ?? '')).toEqual(placeholders(enFlat[key] ?? ''))
      }
    })
  })

  describe('plurals', () => {
    it.each(LOCALE_NAMES)('ships every counted text as _one and _other with {{count}} (%s)', (locale) => {
      const flat = flatten(LOCALES[locale])

      for (const base of PLURAL_BASES) {
        expect(flat[`${base}_one`]).toContain('{{count}}')
        expect(flat[`${base}_other`]).toContain('{{count}}')
        expect(flat[base]).toBeUndefined()
      }
    })

    it.each(LOCALE_NAMES)('leaves the plain texts without a count or a plural form (%s)', (locale) => {
      const flat = flatten(LOCALES[locale])

      for (const key of PLAIN_KEYS) {
        expect(flat[key]).not.toContain('{{')
        expect(flat[`${key}_one`]).toBeUndefined()
        expect(flat[`${key}_other`]).toBeUndefined()
      }
    })

    it.each(LOCALE_NAMES)('words the singular and the plural differently (%s)', (locale) => {
      const flat = flatten(LOCALES[locale])

      for (const base of PLURAL_BASES) {
        expect(flat[`${base}_one`]).not.toBe(flat[`${base}_other`])
      }
    })
  })

  describe('English wording', () => {
    const flat = flatten(LOCALES.en)

    it('words the load more action and its busy state', () => {
      expect(flat['suites.loadMore']).toBe('Load more')
      expect(flat['suites.loadingMore']).toBe('Loading more…')
    })

    it('announces how many suites a page added', () => {
      expect(flat['suites.loadedMoreSuites_one']).toBe('{{count}} more suite loaded')
      expect(flat['suites.loadedMoreSuites_other']).toBe('{{count}} more suites loaded')
    })

    it('announces how many suites are shown after a change', () => {
      expect(flat['suites.suitesShown_one']).toBe('{{count}} suite shown')
      expect(flat['suites.suitesShown_other']).toBe('{{count}} suites shown')
    })
  })

  describe('Spanish wording', () => {
    const flat = flatten(LOCALES.es)

    it('words the load more action and its busy state in neutral Spanish', () => {
      expect(flat['suites.loadMore']).toBe('Cargar más')
      expect(flat['suites.loadingMore']).toBe('Cargando más…')
    })

    it('announces how many suites a page added', () => {
      expect(flat['suites.loadedMoreSuites_one']).toBe('Se cargó {{count}} suite más')
      expect(flat['suites.loadedMoreSuites_other']).toBe('Se cargaron {{count}} suites más')
    })

    it('announces how many suites are shown after a change', () => {
      expect(flat['suites.suitesShown_one']).toBe('{{count}} suite mostrada')
      expect(flat['suites.suitesShown_other']).toBe('{{count}} suites mostradas')
    })
  })

  describe('reused copy', () => {
    it.each(LOCALE_NAMES)('already ships the texts the list reuses (%s)', (locale) => {
      const flat = flatten(LOCALES[locale])

      for (const key of REUSED_KEYS) {
        expect(flat[key]).toBeTypeOf('string')
        expect(flat[key]?.trim()).not.toBe('')
      }
    })

    it('keeps the retry label the load more failure reuses', () => {
      expect(flatten(LOCALES.en)['common.retry']).toBe('Retry')
      expect(flatten(LOCALES.es)['common.retry']).toBe('Reintentar')
    })
  })

  describe('file encoding', () => {
    it.each(['en.json', 'es.json'])('writes %s with real characters, never escape sequences', (file) => {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')

      expect(text).not.toMatch(UNICODE_ESCAPE)
    })

    it.each(LOCALE_NAMES)('ends the busy label with the ellipsis character (%s)', (locale) => {
      const label = flatten(LOCALES[locale])['suites.loadingMore']

      expect(label).toBeTypeOf('string')
      expect(label?.endsWith('…')).toBe(true)
      expect(label).not.toMatch(/\.\.\.$/)
    })
  })
})
