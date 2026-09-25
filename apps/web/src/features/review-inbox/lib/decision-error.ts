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

export interface DecisionConflict {
  action: 'approved' | 'rejected'
  decidedAt: string
  decidedBy: { id: string; name: string }
}

function isDecisionConflict(value: unknown): value is DecisionConflict {
  if (typeof value !== 'object' || value === null) return false
  const { action, decidedAt, decidedBy } = value as Record<string, unknown>
  if (action !== 'approved' && action !== 'rejected') return false
  if (typeof decidedAt !== 'string') return false
  if (typeof decidedBy !== 'object' || decidedBy === null) return false
  const { id, name } = decidedBy as Record<string, unknown>
  return typeof id === 'string' && typeof name === 'string'
}

export function extractDecisionConflict(error: unknown): DecisionConflict | null {
  if (!(error instanceof ApiError)) return null
  const decision = error.details?.decision
  return isDecisionConflict(decision) ? decision : null
}

export function decisionConflictMessageKey(action: DecisionConflict['action']): string {
  return action === 'approved' ? 'decisionConflictApproved' : 'decisionConflictRejected'
}
