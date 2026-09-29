import type { ReviewConflictingCase } from '@qably/types'
import { ApiError } from '@/lib/api-client'

export type DecisionErrorCode =
  | 'invalid-transition'
  | 'missing-evidence'
  | 'missing-suite'
  | 'name-taken'
  | 'automation-key-taken'
  | 'publish-conflict'
  | 'incomplete-proposal'
  | 'error'

const DECISION_ERROR_KEYS: Record<DecisionErrorCode, string> = {
  'invalid-transition': 'decisionAlreadyDecided',
  'missing-evidence': 'decisionMissingEvidence',
  'missing-suite': 'decisionMissingSuite',
  'name-taken': 'decisionNameTaken',
  'automation-key-taken': 'decisionAutomationKeyTaken',
  'publish-conflict': 'decisionPublishConflict',
  'incomplete-proposal': 'decisionIncompleteProposal',
  error: 'decisionError',
}

const DECISION_ERROR_KEYS_WITH_CASE: Partial<Record<DecisionErrorCode, string>> = {
  'automation-key-taken': 'decisionAutomationKeyTakenWithCase',
}

const APPROVAL_CONFLICT_CODES: ReadonlySet<DecisionErrorCode> = new Set([
  'name-taken',
  'automation-key-taken',
  'publish-conflict',
])

export function classifyDecisionError(error: unknown): DecisionErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invalid-transition':
      case 'missing-evidence':
      case 'missing-suite':
      case 'name-taken':
      case 'automation-key-taken':
      case 'publish-conflict':
      case 'incomplete-proposal':
        return error.code
    }
  }
  return 'error'
}

export function isApprovalConflictCode(code: DecisionErrorCode): boolean {
  return APPROVAL_CONFLICT_CODES.has(code)
}

export function decisionErrorKey(
  code: DecisionErrorCode,
  conflictingCase: ReviewConflictingCase | null = null,
): string {
  if (conflictingCase !== null) {
    const withCase = DECISION_ERROR_KEYS_WITH_CASE[code]
    if (withCase !== undefined) return withCase
  }
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

function isConflictingCase(value: unknown): value is ReviewConflictingCase {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, suiteId } = value as Record<string, unknown>
  return typeof id === 'string' && typeof name === 'string' && typeof suiteId === 'string'
}

export function extractConflictingCase(error: unknown): ReviewConflictingCase | null {
  if (!(error instanceof ApiError)) return null
  const conflictingCase = error.details?.conflictingCase
  return isConflictingCase(conflictingCase) ? conflictingCase : null
}

export function decisionConflictMessageKey(action: DecisionConflict['action']): string {
  return action === 'approved' ? 'decisionConflictApproved' : 'decisionConflictRejected'
}
