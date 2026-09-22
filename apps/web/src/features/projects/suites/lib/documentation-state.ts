import type { Suite } from '@qably/types'

export interface DocumentationTiming {
  queuedAt: string | null
  outcomeAt: string | null
}

export function isDocumenting(state: DocumentationTiming | undefined): boolean {
  if (state === undefined || state.queuedAt === null) return false
  if (state.outcomeAt === null) return true
  return state.outcomeAt <= state.queuedAt
}

export interface DocumentationOutcomeState {
  outcome: 'complete' | 'incomplete' | 'failed' | 'skipped' | null
}

export function isOutcomeIncomplete(state: DocumentationOutcomeState | undefined): boolean {
  if (state === undefined) return false
  return state.outcome === 'incomplete' || state.outcome === 'skipped' || state.outcome === 'failed'
}

export function isDocumentationBusy(suite: Suite | undefined): boolean {
  if (suite === undefined) return false
  if (isDocumenting(suite.documentation)) return true
  return suite.cases.some((testCase) => isDocumenting(testCase.documentation))
}
