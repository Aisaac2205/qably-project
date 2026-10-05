import { describe, expect, it } from 'vitest'
import { en, es } from './index'

interface Tree {
  [key: string]: string | Tree
}

function runsNode(locale: unknown): Tree {
  return (locale as { runs: Tree }).runs
}

describe('run case version copy', () => {
  it.each([
    ['en', en, 'Version {{version}}'],
    ['es', es, 'Versión {{version}}'],
  ])('names the chip after the library case it reads from (%s)', (_name, locale, text) => {
    const runs = runsNode(locale)

    expect(runs.caseVersion).toBe(text)
    expect(runs.versionSnapshot).toBeUndefined()
  })
})
