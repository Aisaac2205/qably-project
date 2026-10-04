import { describe, expect, it } from 'vitest'
import { parseSuiteParam } from '@/features/runs/lib/suite-param'

describe('parseSuiteParam', () => {
  it('keeps a suite id as it came in the address', () => {
    expect(parseSuiteParam('suite-1')).toBe('suite-1')
  })

  it.each<[string, unknown]>([
    ['is absent', undefined],
    ['is empty', ''],
    ['is only spaces', '   '],
    ['is repeated', ['suite-1', 'suite-2']],
    ['is a one item list', ['suite-1']],
    ['is not text', 42],
    ['is null', null],
  ])('treats a suite value that %s as no suite', (_label, value) => {
    expect(parseSuiteParam(value)).toBeUndefined()
  })
})
