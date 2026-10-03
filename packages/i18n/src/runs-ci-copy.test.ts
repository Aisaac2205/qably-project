import { describe, expect, it } from 'vitest'
import { en, es } from './index'

interface Tree {
  [key: string]: string | Tree
}

const LOCALES = { en: en as unknown as Tree, es: es as unknown as Tree }
const SCOPES = ['runs.ci', 'status.ciRun'] as const
const PLURAL_SUFFIX = /_(one|other)$/

const EXPECTED_PLURAL_BASES = [
  'runs.ci.freshnessSeconds',
  'runs.ci.freshnessMinutes',
  'runs.ci.freshnessHours',
  'runs.ci.freshnessDays',
  'runs.ci.durationSeconds',
  'runs.ci.durationMinutes',
  'runs.ci.durationHours',
  'runs.ci.suitesShow',
  'runs.ci.suitesHide',
]

const FORBIDDEN_ES_WORDS = new RegExp(
  '^(job|run|workflow|load|show|passing|failing|passed|failed|branch|actor)s?$',
)
const FORBIDDEN_STATE_WORDS =
  /aprobad[ao]s?|completad[ao]s?|terminad[ao]s?|finalizad[ao]s?|passed|completed|finished/i

function flatten(node: Tree, prefix = ''): Record<string, string> {
  return Object.entries(node).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const path = prefix === '' ? key : `${prefix}.${key}`
      return typeof value === 'string'
        ? { ...acc, [path]: value }
        : { ...acc, ...flatten(value, path) }
    },
    {},
  )
}

function scopeEntries(locale: Tree, scope: string): [string, string][] {
  return Object.entries(flatten(locale)).filter(([key]) =>
    key.startsWith(`${scope}.`),
  )
}

function familyEntries(locale: Tree): [string, string][] {
  return SCOPES.flatMap((scope) => scopeEntries(locale, scope))
}

function words(text: string): string[] {
  return text
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '')
}

describe('runs.ci and status.ciRun copy', () => {
  describe('locale parity', () => {
    it.each(SCOPES)('ships the same keys in en and es for %s', (scope) => {
      const enKeys = scopeEntries(LOCALES.en, scope)
        .map(([key]) => key)
        .sort()
      const esKeys = scopeEntries(LOCALES.es, scope)
        .map(([key]) => key)
        .sort()

      expect(enKeys.length).toBeGreaterThan(0)
      expect(esKeys).toEqual(enKeys)
    })

    it('keeps interpolation placeholders identical across locales', () => {
      const enFlat = flatten(LOCALES.en)
      const esFlat = flatten(LOCALES.es)
      const placeholders = (value: string) =>
        (value.match(/\{\{[^}]*\}\}/g) ?? []).sort()

      const entries = familyEntries(LOCALES.en)
      expect(entries.length).toBeGreaterThan(0)
      for (const [key, value] of entries) {
        expect(placeholders(esFlat[key] ?? '')).toEqual(placeholders(enFlat[key] ?? value))
      }
    })
  })

  describe('plurals', () => {
    it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
      'ships every counted text as _one and _other with {{count}} (%s)',
      (locale) => {
        const flat = flatten(LOCALES[locale])
        const entries = scopeEntries(LOCALES[locale], 'runs.ci')
        const counted = entries.filter(([, value]) => value.includes('{{count}}'))
        const bases = new Set(
          entries
            .filter(([key]) => PLURAL_SUFFIX.test(key))
            .map(([key]) => key.replace(PLURAL_SUFFIX, '')),
        )

        expect(counted.length).toBeGreaterThan(0)
        expect([...bases].sort()).toEqual([...EXPECTED_PLURAL_BASES].sort())
        for (const [key] of counted) {
          expect(key).toMatch(PLURAL_SUFFIX)
        }
        for (const base of bases) {
          expect(flat[`${base}_one`]).toContain('{{count}}')
          expect(flat[`${base}_other`]).toContain('{{count}}')
        }
      },
    )

    it('words the singular and plural disclosure in Spanish', () => {
      const flat = flatten(LOCALES.es)

      expect(flat['runs.ci.suitesShow_one']).toBe('Ver {{count}} suite sin fallos')
      expect(flat['runs.ci.suitesShow_other']).toBe('Ver {{count}} suites sin fallos')
      expect(flat['runs.ci.suitesHide_one']).toBe('Ocultar {{count}} suite sin fallos')
      expect(flat['runs.ci.suitesHide_other']).toBe('Ocultar {{count}} suites sin fallos')
    })

    it('words the singular and plural disclosure in English', () => {
      const flat = flatten(LOCALES.en)

      expect(flat['runs.ci.suitesShow_one']).toBe('Show {{count}} suite without failures')
      expect(flat['runs.ci.suitesShow_other']).toBe('Show {{count}} suites without failures')
      expect(flat['runs.ci.suitesHide_one']).toBe('Hide {{count}} suite without failures')
      expect(flat['runs.ci.suitesHide_other']).toBe('Hide {{count}} suites without failures')
    })
  })

  describe('closed vocabulary', () => {
    it('keeps english words out of the Spanish copy', () => {
      const entries = familyEntries(LOCALES.es)

      expect(entries.length).toBeGreaterThan(0)
      for (const [key, value] of entries) {
        const leaked = words(value).filter((word) => FORBIDDEN_ES_WORDS.test(word))
        expect({ key, leaked }).toEqual({ key, leaked: [] })
      }
    })

    it('detects an english word leaking into Spanish copy', () => {
      expect(words('Cargar más {{count}} jobs en el workflow')).toEqual([
        'cargar',
        'más',
        'jobs',
        'en',
        'el',
        'workflow',
      ])
      expect(
        words('Ver los jobs').filter((word) => FORBIDDEN_ES_WORDS.test(word)),
      ).toEqual(['jobs'])
      expect(
        words('Trabajo de la ejecución').filter((word) =>
          FORBIDDEN_ES_WORDS.test(word),
        ),
      ).toEqual([])
    })

    it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
      'never mentions an unidentified job (%s)',
      (locale) => {
        const familyKeys = familyEntries(LOCALES[locale]).map(([key]) => key)
        const serialised = JSON.stringify(LOCALES[locale])

        expect(familyKeys.length).toBeGreaterThan(0)
        expect(serialised).not.toMatch(/unknown job/i)
        expect(serialised).not.toMatch(/trabajo sin identificar/i)
        expect(serialised).not.toMatch(/unidentified job/i)
        expect(
          familyKeys.filter((key) =>
            /unknown|unidentified|unnamed|sinIdentificar/i.test(key),
          ),
        ).toEqual([])
      },
    )
  })

  describe('execution status chip', () => {
    it('says Sin fallos / Con fallos in Spanish', () => {
      const flat = flatten(LOCALES.es)

      expect(flat['status.ciRun.passing']).toBe('Sin fallos')
      expect(flat['status.ciRun.failing']).toBe('Con fallos')
    })

    it('says No failures / Has failures in English', () => {
      const flat = flatten(LOCALES.en)

      expect(flat['status.ciRun.passing']).toBe('No failures')
      expect(flat['status.ciRun.failing']).toBe('Has failures')
    })

    it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
      'never labels a CI run as passed, completed or finished (%s)',
      (locale) => {
        const entries = familyEntries(LOCALES[locale])

        expect(entries.length).toBeGreaterThan(0)
        for (const [key, value] of entries) {
          expect({ key, forbidden: FORBIDDEN_STATE_WORDS.test(value) }).toEqual({
            key,
            forbidden: false,
          })
        }
      },
    )

    it('keeps the tooltips free of finality claims and explains the reporting gap', () => {
      const esFlat = flatten(LOCALES.es)
      const enFlat = flatten(LOCALES.en)

      expect(esFlat['runs.ci.durationTooltip']).toBe(
        'Aproximado: entre el primer y el último reporte',
      )
      expect(enFlat['runs.ci.durationTooltip']).toBe(
        'Approximate: between the first and the last report',
      )
      expect(esFlat['runs.ci.statusTooltip']).toBe(
        'Según los reportes recibidos hasta ahora. Los trabajos que no suben un reporte de pruebas no aparecen.',
      )
      expect(enFlat['runs.ci.statusTooltip']).toBe(
        'Based on the reports received so far. Jobs that do not upload a test report are not shown.',
      )
    })
  })

  describe('navigation and detail copy', () => {
    it('names the tabs and the tab list', () => {
      const esFlat = flatten(LOCALES.es)
      const enFlat = flatten(LOCALES.en)

      expect(esFlat['runs.ci.tabActions']).toBe('Acciones')
      expect(enFlat['runs.ci.tabActions']).toBe('Actions')
      expect(esFlat['runs.ci.tabManual']).toBe('Manual')
      expect(enFlat['runs.ci.tabManual']).toBe('Manual')
      expect(esFlat['runs.ci.tabsAria']).toBe('Origen de las ejecuciones')
      expect(enFlat['runs.ci.tabsAria']).toBe('Run source')
    })

    it('formats the CI number for the meta line and the breadcrumb', () => {
      expect(flatten(LOCALES.es)['runs.ci.ciNumber']).toBe('CI #{{number}}')
      expect(flatten(LOCALES.en)['runs.ci.ciNumber']).toBe('CI #{{number}}')
    })

    it('words the list actions and states', () => {
      const esFlat = flatten(LOCALES.es)
      const enFlat = flatten(LOCALES.en)

      expect(esFlat['runs.ci.loadMore']).toBe('Cargar más')
      expect(enFlat['runs.ci.loadMore']).toBe('Load more')
      expect(esFlat['runs.ci.loadingMore']).toBe('Cargando…')
      expect(enFlat['runs.ci.loadingMore']).toBe('Loading…')
      expect(esFlat['runs.ci.emptyDocsLink']).toBe('Cómo reportar resultados desde CI')
      expect(enFlat['runs.ci.emptyDocsLink']).toBe('How to report results from CI')
    })

    it('tells the reader the GitHub link opens in a new tab and names its target', () => {
      const esAria = flatten(LOCALES.es)['runs.ci.githubLinkAria']
      const enAria = flatten(LOCALES.en)['runs.ci.githubLinkAria']

      expect(esAria).toContain('{{repository}}')
      expect(esAria).toContain('{{host}}')
      expect(esAria).toMatch(/pestaña nueva/)
      expect(enAria).toContain('{{repository}}')
      expect(enAria).toContain('{{host}}')
      expect(enAria).toMatch(/new tab/)
    })

    it('ships the not found state with a way back', () => {
      const esFlat = flatten(LOCALES.es)
      const enFlat = flatten(LOCALES.en)

      expect(esFlat['runs.ci.notFoundTitle']).toBe('Ejecución no encontrada')
      expect(enFlat['runs.ci.notFoundTitle']).toBe('Run not found')
      expect(esFlat['runs.ci.backToList']).toBe('Volver a las ejecuciones')
      expect(enFlat['runs.ci.backToList']).toBe('Back to runs')
    })
  })
})
