import { ApiError } from '@/lib/api-client'

export type DecisionErrorCode =
  | 'invalid-transition'
  | 'missing-evidence'
  | 'missing-suite'
  | 'name-taken'
  | 'incomplete-proposal'
  | 'error'

const DECISION_ERROR_KEYS: Record<DecisionErrorCode, string> = {
  'invalid-transition': 'decisionAlreadyDecided',
  'missing-evidence': 'decisionMissingEvidence',
  'missing-suite': 'decisionMissingSuite',
  'name-taken': 'decisionNameTaken',
  'incomplete-proposal': 'decisionIncompleteProposal',
  error: 'decisionError',
}

export function classifyDecisionError(error: unknown): DecisionErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invalid-transition':
      case 'missing-evidence':
      case 'missing-suite':
      case 'name-taken':
      case 'incomplete-proposal':
        return error.code
    }
  }
  return 'error'
}

export function decisionErrorKey(code: DecisionErrorCode): string {
  return DECISION_ERROR_KEYS[code]
}
