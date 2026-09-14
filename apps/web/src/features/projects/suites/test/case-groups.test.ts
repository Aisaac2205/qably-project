import { describe, expect, it } from 'vitest'
import type { TestCase } from '@qably/types'
import { groupCasesForDisplay, GROUP_CASES_THRESHOLD } from '@/features/projects/suites/lib/case-groups'

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

function documented(id: string): TestCase {
  return testCase({ id })
}

function undocumented(id: string): TestCase {
  return testCase({ id, steps: [], expectedResult: '', state: 'draft', healthSignals: ['no-steps'] })
}

describe('groupCasesForDisplay', () => {
  it('does not group a suite at or below the threshold, however mixed its cases are', () => {
    const cases = Array.from({ length: GROUP_CASES_THRESHOLD }, (_, i) =>
      i % 2 === 0 ? documented(`c${i}`) : undocumented(`c${i}`),
    )

    expect(groupCasesForDisplay(cases)).toBeNull()
  })

  it('groups a suite above the threshold into a single "documented" group when every case is already documented', () => {
    const cases = Array.from({ length: GROUP_CASES_THRESHOLD + 1 }, (_, i) => documented(`c${i}`))

    const groups = groupCasesForDisplay(cases)

    expect(groups).toEqual([{ key: 'documented', cases }])
  })

  it('splits a large mixed suite into a needs-attention group and a documented group, attention first', () => {
    const needsAttention = [undocumented('u1'), undocumented('u2')]
    const rest = Array.from({ length: GROUP_CASES_THRESHOLD - 1 }, (_, i) => documented(`d${i}`))
    const cases = [...rest, ...needsAttention]

    const groups = groupCasesForDisplay(cases)

    expect(groups).toEqual([
      { key: 'needsAttention', cases: needsAttention },
      { key: 'documented', cases: rest },
    ])
  })

  it('omits the needs-attention group entirely rather than rendering an empty header', () => {
    const cases = Array.from({ length: GROUP_CASES_THRESHOLD + 3 }, (_, i) => documented(`d${i}`))

    const groups = groupCasesForDisplay(cases)

    expect(groups).toHaveLength(1)
    expect(groups?.[0]?.key).toBe('documented')
  })
})
