import type { CaseHealthSignal, TestCase } from '@qably/types'

export type CaseAttention =
  | 'in-review'
  | 'undocumented'
  | 'awaiting-confirmation'
  | 'never-run'

export const WORKFLOW_HEALTH_SIGNALS: readonly CaseHealthSignal[] = [
  'no-steps',
  'never-run',
]

function isDocumented(testCase: TestCase): boolean {
  return testCase.steps.length > 0 || testCase.expectedResult.trim() !== ''
}

export function deriveCaseAttention(testCase: TestCase): CaseAttention | null {
  if (testCase.pendingProposalId != null) return 'in-review'

  if (testCase.executionMode === 'automated' && !isDocumented(testCase)) {
    return 'undocumented'
  }

  if (testCase.state === 'draft' && isDocumented(testCase)) {
    return 'awaiting-confirmation'
  }

  if (testCase.healthSignals?.includes('never-run') === true) return 'never-run'

  return null
}
