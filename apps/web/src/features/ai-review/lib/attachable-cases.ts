import { MAX_ATTACHED_CASES, type AttachedCaseRecord, type Suite } from '@qably/types'

export { MAX_ATTACHED_CASES }

export function flattenAttachableCases(suites: Suite[]): AttachedCaseRecord[] {
  return suites.flatMap((suite) =>
    suite.cases.map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      suiteName: suite.name,
    })),
  )
}
