import type { TestCase } from '@qably/types'

function isDocumented(testCase: TestCase): boolean {
  return testCase.steps.length > 0 || testCase.expectedResult.trim() !== ''
}

export function casesAwaitingConfirmation(cases: TestCase[]): TestCase[] {
  return cases.filter(
    (testCase) =>
      testCase.executionMode === 'automated' &&
      testCase.state === 'draft' &&
      testCase.pendingProposalId == null &&
      isDocumented(testCase),
  )
}
