import type { AttachedCaseRecord, Suite } from '@qably/types'

export const MAX_ATTACHED_CASES = 5

export function flattenAttachableCases(suites: Suite[]): AttachedCaseRecord[] {
  return suites.flatMap((suite) =>
    suite.cases.map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      suiteName: suite.name,
    })),
  )
}
