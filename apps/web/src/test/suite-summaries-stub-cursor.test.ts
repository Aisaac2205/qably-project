import { describe, expect, it } from 'vitest'
import { SUITE_SUMMARY_SORTS, type SuiteSortKey } from '@qably/types'
import { decodeCursor, encodeCursor } from '@/test/suite-summaries-stub-cursor'

const CREATED_AT = '2026-01-02T03:04:05.678Z'

const RECENT = { sort: 'recent', createdAt: CREATED_AT, id: 's1' } satisfies SuiteSortKey
const NAME = { sort: 'name', name: 'Alpha', id: 's1' } satisfies SuiteSortKey
const PASS_RATE = {
  sort: 'pass-rate',
  recentPassRate: 60,
  createdAt: CREATED_AT,
  id: 's1',
} satisfies SuiteSortKey
const CASES = {
  sort: 'cases',
  caseCount: 3,
  createdAt: CREATED_AT,
  id: 's1',
} satisfies SuiteSortKey

const KEYS = { recent: RECENT, name: NAME, 'pass-rate': PASS_RATE, cases: CASES }

const DATED_SORTS = ['recent', 'pass-rate', 'cases'] as const

function forged(fields: object): string {
  return `stub-cursor:${JSON.stringify(fields)}`
}

function without(fields: object, key: string): object {
  return Object.fromEntries(Object.entries(fields).filter(([name]) => name !== key))
}

describe('stub suite summaries cursor', () => {
  describe('round trip', () => {
    it.each(SUITE_SUMMARY_SORTS)('gives back the %s key it was built from', (sort) => {
      expect(decodeCursor(encodeCursor(KEYS[sort]), sort)).toStrictEqual(KEYS[sort])
    })

    it.each([null, 0, 100])('keeps the pass rate %s', (recentPassRate) => {
      const key = { ...PASS_RATE, recentPassRate } satisfies SuiteSortKey

      expect(decodeCursor(encodeCursor(key), 'pass-rate')).toStrictEqual(key)
    })

    it('keeps a zero case count', () => {
      const key = { ...CASES, caseCount: 0 } satisfies SuiteSortKey

      expect(decodeCursor(encodeCursor(key), 'cases')).toStrictEqual(key)
    })

    it('keeps a name that is not plain ASCII', () => {
      const key = { ...NAME, name: 'Árbol ñandú' } satisfies SuiteSortKey

      expect(decodeCursor(encodeCursor(key), 'name')).toStrictEqual(key)
    })
  })

  describe('rejections', () => {
    it.each([
      ['a string without the prefix', 'not-a-cursor'],
      ['an empty string', ''],
      ['a prefix followed by invalid JSON', 'stub-cursor:{'],
      ['a prefix followed by a JSON number', 'stub-cursor:5'],
      ['a prefix followed by JSON null', 'stub-cursor:null'],
    ])('rejects %s', (_label, cursor) => {
      expect(() => decodeCursor(cursor, 'recent')).toThrow(/cursor/i)
    })

    it('rejects a cursor issued for another sort', () => {
      expect(() => decodeCursor(encodeCursor(RECENT), 'name')).toThrow(/cursor/i)
    })

    it.each(SUITE_SUMMARY_SORTS)('rejects a %s key without an id', (sort) => {
      expect(() => decodeCursor(forged(without(KEYS[sort], 'id')), sort)).toThrow(/cursor/i)
    })

    it.each(SUITE_SUMMARY_SORTS)('rejects a %s key with an empty id', (sort) => {
      expect(() => decodeCursor(forged({ ...KEYS[sort], id: '' }), sort)).toThrow(/cursor/i)
    })

    it.each(SUITE_SUMMARY_SORTS)('rejects a %s key whose id is not a string', (sort) => {
      expect(() => decodeCursor(forged({ ...KEYS[sort], id: 7 }), sort)).toThrow(/cursor/i)
    })

    it.each(DATED_SORTS)('rejects a %s key without createdAt', (sort) => {
      expect(() => decodeCursor(forged(without(KEYS[sort], 'createdAt')), sort)).toThrow(
        /cursor/i,
      )
    })

    it.each(DATED_SORTS)('rejects a %s key whose createdAt is not canonical ISO', (sort) => {
      const notCanonical = [
        '2026-01-02',
        '2026-01-02T03:04:05Z',
        '2026-01-02T03:04:05.678+02:00',
        'yesterday',
        '',
        1767323045678,
      ]

      for (const createdAt of notCanonical) {
        expect(() => decodeCursor(forged({ ...KEYS[sort], createdAt }), sort)).toThrow(/cursor/i)
      }
    })

    it('rejects a name key without a string name', () => {
      expect(() => decodeCursor(forged(without(NAME, 'name')), 'name')).toThrow(/cursor/i)
      expect(() => decodeCursor(forged({ ...NAME, name: 5 }), 'name')).toThrow(/cursor/i)
    })

    it.each([
      ['missing', undefined],
      ['above 100', 101],
      ['below 0', -1],
      ['not an integer', 33.3],
      ['a string', '60'],
    ])('rejects a pass rate that is %s', (_label, recentPassRate) => {
      expect(() => decodeCursor(forged({ ...PASS_RATE, recentPassRate }), 'pass-rate')).toThrow(
        /cursor/i,
      )
    })

    it.each([
      ['missing', undefined],
      ['negative', -1],
      ['not an integer', 2.5],
      ['not a safe integer', Number.MAX_SAFE_INTEGER + 1],
      ['a string', '3'],
      ['null', null],
    ])('rejects a case count that is %s', (_label, caseCount) => {
      expect(() => decodeCursor(forged({ ...CASES, caseCount }), 'cases')).toThrow(/cursor/i)
    })
  })
})
