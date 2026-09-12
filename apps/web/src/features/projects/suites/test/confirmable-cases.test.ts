import { describe, expect, it } from 'vitest'
import type { TestCase } from '@qably/types'
import { casesAwaitingConfirmation } from '@/features/projects/suites/lib/confirmable-cases'

function testCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    version: 1,
    name: 'Checkout completes the order',
    steps: ['Open the cart', 'Pay'],
    expectedResult: 'The order is created',
    priority: 'high',
    state: 'draft',
    executionMode: 'automated',
    ...overrides,
  }
}

describe('casesAwaitingConfirmation', () => {
  it('returns automated drafts that already carry documentation', () => {
    const cases = [testCase()]

    expect(casesAwaitingConfirmation(cases).map((item) => item.id)).toEqual(['case-1'])
  })

  it('ignores cases a person already confirmed', () => {
    const cases = [testCase({ state: 'active' })]

    expect(casesAwaitingConfirmation(cases)).toEqual([])
  })

  it('ignores drafts with nothing written on them yet', () => {
    const cases = [testCase({ steps: [], expectedResult: '' })]

    expect(casesAwaitingConfirmation(cases)).toEqual([])
  })

  it('counts a draft documented with an expected result but no steps', () => {
    const cases = [testCase({ steps: [] })]

    expect(casesAwaitingConfirmation(cases).map((item) => item.id)).toEqual(['case-1'])
  })

  it('leaves manual cases to their author', () => {
    const cases = [testCase({ executionMode: 'manual' })]

    expect(casesAwaitingConfirmation(cases)).toEqual([])
  })

  it('leaves a case still waiting in the review inbox alone', () => {
    const cases = [testCase({ pendingProposalId: 'proposal-1' })]

    expect(casesAwaitingConfirmation(cases)).toEqual([])
  })

  it('returns an empty list for a suite with no cases', () => {
    expect(casesAwaitingConfirmation([])).toEqual([])
  })
})
