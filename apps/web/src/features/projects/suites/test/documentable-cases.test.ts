import { describe, expect, it } from 'vitest'
import type { TestCase } from '@qably/types'
import { countDocumentableCases, localeNameKey } from '../lib/documentable-cases'

function testCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    name: 'Cart adds an item',
    steps: [],
    expectedResult: '',
    priority: 'medium',
    state: 'draft',
    executionMode: 'automated',
    ...overrides,
  } as TestCase
}

describe('countDocumentableCases', () => {
  it('counts an automated case with no steps and no pending proposal', () => {
    expect(countDocumentableCases([testCase()])).toBe(1)
  })

  it('ignores a case that already has steps', () => {
    expect(countDocumentableCases([testCase({ steps: ['Open the cart'] })])).toBe(0)
  })

  it('ignores a manual case, because Aeris documents from test source only', () => {
    expect(countDocumentableCases([testCase({ executionMode: 'manual' })])).toBe(0)
  })

  it('ignores a case whose proposal is already waiting in review', () => {
    expect(
      countDocumentableCases([testCase({ pendingProposalId: 'proposal-1' })]),
    ).toBe(0)
  })

  it('counts only the documentable cases in a mixed suite', () => {
    expect(
      countDocumentableCases([
        testCase({ id: 'a' }),
        testCase({ id: 'b' }),
        testCase({ id: 'c', executionMode: 'manual' }),
        testCase({ id: 'd', steps: ['Open the cart'] }),
        testCase({ id: 'e', pendingProposalId: 'proposal-2' }),
      ]),
    ).toBe(2)
  })

  it('counts nothing in an empty suite', () => {
    expect(countDocumentableCases([])).toBe(0)
  })
})

describe('localeNameKey', () => {
  it('maps the two supported locales and falls back for anything else', () => {
    expect(localeNameKey('es')).toBe('suites.localeNameEs')
    expect(localeNameKey('en')).toBe('suites.localeNameEn')
    expect(localeNameKey('pt')).toBe('suites.localeNameOther')
  })
})
