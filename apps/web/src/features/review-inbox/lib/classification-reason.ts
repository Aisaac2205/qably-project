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
  score: null,
  reasons: [],
}

export function resolveClassification(
  classification: ProposalClassification | undefined,
): ProposalClassification {
  return classification ?? NONE_CLASSIFICATION
}
