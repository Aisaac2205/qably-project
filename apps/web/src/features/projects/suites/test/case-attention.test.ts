import { describe, expect, it } from 'vitest'
import type { TestCase } from '@qably/types'
import { deriveCaseAttention } from '@/features/projects/suites/lib/case-attention'

function testCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    version: 1,
    name: 'Checkout completes the order',
    objective: '',
    preconditions: [],
    steps: ['Open the cart', 'Pay'],
    expectedResult: 'The order is created',
    priority: 'high',
    state: 'active',
    executionMode: 'automated',
    ...overrides,
  }
}

describe('deriveCaseAttention', () => {
  it('returns nothing for a confirmed case that has already run', () => {
    expect(deriveCaseAttention(testCase({ healthSignals: [] }))).toBeNull()
  })

  it('puts a case waiting in the review inbox above every other state', () => {
    const subject = testCase({
      pendingProposalId: 'proposal-1',
      steps: [],
      expectedResult: '',
      state: 'draft',
      healthSignals: ['no-steps'],
    })

    expect(deriveCaseAttention(subject)).toBe('in-review')
  })

  it('asks for documentation before anything else once nothing is written', () => {
    const subject = testCase({
      steps: [],
      expectedResult: '',
      state: 'draft',
      healthSignals: ['no-steps'],
    })

    expect(deriveCaseAttention(subject)).toBe('undocumented')
  })

  it('asks for confirmation on a draft that already carries documentation', () => {
    const subject = testCase({ state: 'draft', healthSignals: [] })

    expect(deriveCaseAttention(subject)).toBe('awaiting-confirmation')
  })

  it('returns nothing once the case is documented and confirmed, even without run history', () => {
    const subject = testCase({ healthSignals: [] })

    expect(deriveCaseAttention(subject)).toBeNull()
  })

  it('leaves an undocumented manual case to its author rather than blaming Aeris', () => {
    const subject = testCase({
      executionMode: 'manual',
      steps: [],
      expectedResult: '',
      state: 'draft',
    })

    expect(deriveCaseAttention(subject)).toBeNull()
  })

  it('ignores quality signals that are not a workflow state', () => {
    const subject = testCase({ healthSignals: ['flaky', 'raw-name'] })

    expect(deriveCaseAttention(subject)).toBeNull()
  })
})
