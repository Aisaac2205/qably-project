import { describe, expect, it } from 'vitest'
import { en, es } from './index'

interface Tree {
  [key: string]: string | Tree
}

const LOCALES = { en: en as unknown as Tree, es: es as unknown as Tree }
const NEW_RUN_KEY = /^runs\.newRun/

function flatten(node: Tree, prefix = ''): Record<string, string> {
  return Object.entries(node).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) }
  }, {})
}

function newRunKeys(locale: Tree): string[] {
  return Object.keys(flatten(locale))
    .filter((key) => NEW_RUN_KEY.test(key))
    .sort()
}

describe('new run dialog copy', () => {
  it('ships the same new run keys in en and es', () => {
    expect(newRunKeys(LOCALES.en)).toContain('runs.newRunDescription')
    expect(newRunKeys(LOCALES.es)).toEqual(newRunKeys(LOCALES.en))
  })

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
    'describes the dialog with plain copy and no placeholder or plural form (%s)',
    (locale) => {
      const flat = flatten(LOCALES[locale])
      const description = flat['runs.newRunDescription']

      expect(description).toBeTypeOf('string')
      expect(description?.trim()).not.toBe('')
      expect(description).not.toContain('{{')
      expect(flat['runs.newRunDescription_one']).toBeUndefined()
      expect(flat['runs.newRunDescription_other']).toBeUndefined()
      expect(description).not.toBe(flat['runs.newRun'])
      expect(description).not.toBe(flat['runs.noSuitesAvailable'])
    },
  )

  it('words the description in English around what a run records', () => {
    expect(flatten(LOCALES.en)['runs.newRunDescription']).toBe(
      'Select a suite to record a result for each of its manual cases.',
    )
  })

  it('words the description in neutral Spanish without voseo', () => {
    expect(flatten(LOCALES.es)['runs.newRunDescription']).toBe(
      'Selecciona una suite para registrar el resultado de cada uno de sus casos manuales.',
    )
  })
})
