import type { TestCase } from '@qably/types'

export function countDocumentableCases(cases: readonly TestCase[]): number {
  return cases.filter(
    (testCase) =>
      testCase.executionMode === 'automated' &&
      testCase.steps.length === 0 &&
      !testCase.pendingProposalId,
  ).length
}
