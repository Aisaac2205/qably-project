import { describe, expect, it } from 'vitest'
import { en, es } from './index'

interface Tree {
  [key: string]: string | Tree
}

const LOCALES = { en: en as unknown as Tree, es: es as unknown as Tree }

function common(locale: Tree): Tree {
  return locale.common as Tree
}

describe('common close copy', () => {
  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
    'ships a plain close label with no placeholder or plural form (%s)',
    (locale) => {
      const scope = common(LOCALES[locale])

      expect(scope.close).toBeTypeOf('string')
      expect((scope.close as string).trim()).not.toBe('')
      expect(scope.close).not.toContain('{{')
      expect(scope.close_one).toBeUndefined()
      expect(scope.close_other).toBeUndefined()
    },
  )

  it('words the label as Close in English', () => {
    expect(common(LOCALES.en).close).toBe('Close')
  })

  it('words the label as Cerrar in Spanish', () => {
    expect(common(LOCALES.es).close).toBe('Cerrar')
  })

  it('keeps the label distinct from the dismiss label of notices', () => {
    expect(common(LOCALES.en).close).not.toBe(common(LOCALES.en).dismiss)
    expect(common(LOCALES.es).close).not.toBe(common(LOCALES.es).dismiss)
  })
})
