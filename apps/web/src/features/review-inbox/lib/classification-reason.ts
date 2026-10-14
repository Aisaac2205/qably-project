import { suiteEditCasePath } from '@/features/projects/lib/routes'
import type { DuplicateReason, ProposalClassification } from '../api/review.api'

const REASON_KEYS: Record<DuplicateReason, string> = {
  'same-automation-key': 'classificationReasonSameAutomationKey',
  'same-title': 'classificationReasonSameTitle',
  'title-overlap': 'classificationReasonTitleOverlap',
  'steps-overlap': 'classificationReasonStepsOverlap',
  'expected-result-overlap': 'classificationReasonExpectedResultOverlap',
  'cross-suite-key': 'classificationReasonCrossSuiteKey',
}

export function classificationReasonKey(reason: DuplicateReason): string {
  return REASON_KEYS[reason]
}

export function classificationScorePercent(score: number | null): number | null {
  if (score === null) return null
  return Math.round(score * 100)
}

const NONE_CLASSIFICATION: ProposalClassification = {
  kind: 'none',
  matchedCaseId: null,
  matchedCaseName: null,
  matchedCaseSuiteId: null,
  score: null,
  reasons: [],
}

export function resolveClassification(
  classification: ProposalClassification | undefined,
): ProposalClassification {
  return classification ?? NONE_CLASSIFICATION
}

/**
 * A possible duplicate that still has a case to update is the one approval
 * that needs a choice: update that case, or create a new one. Without it the
 * approval would silently create the duplicate.
 */
export function needsApplyChoice(classification: ProposalClassification): boolean {
  return classification.kind === 'possible_duplicate' && classification.matchedCaseId !== null
}

/** Where the matched case lives, or null when it cannot be located (e.g. it was deleted). */
export function matchedCaseHref(
  projectId: string,
  classification: ProposalClassification,
): string | null {
  if (classification.matchedCaseId === null || classification.matchedCaseSuiteId === null) {
    return null
  }

  return suiteEditCasePath(projectId, classification.matchedCaseSuiteId, classification.matchedCaseId)
}
