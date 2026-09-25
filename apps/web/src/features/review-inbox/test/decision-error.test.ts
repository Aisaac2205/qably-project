import { describe, it, expect } from 'vitest'
import {
  classifyDecisionError,
  decisionErrorKey,
  decisionConflictMessageKey,
  extractDecisionConflict,
} from '@/features/review-inbox/lib/decision-error'
import { ApiError } from '@/lib/api-client'

describe('classifyDecisionError', () => {
  it('maps a known ApiError code to its DecisionErrorCode', () => {
    const error = new ApiError(409, 'Conflict', 'invalid-transition')

    expect(classifyDecisionError(error)).toBe('invalid-transition')
  })

  it('falls back to error for an ApiError with an unrecognized code', () => {
    const error = new ApiError(500, 'Server error', 'something-else')

    expect(classifyDecisionError(error)).toBe('error')
  })

  it('falls back to error for a non-ApiError value', () => {
    expect(classifyDecisionError(new Error('boom'))).toBe('error')
  })
})

describe('decisionErrorKey', () => {
  it('maps invalid-transition to the already-decided i18n key', () => {
    expect(decisionErrorKey('invalid-transition')).toBe('decisionAlreadyDecided')
  })

  it('maps incomplete-proposal to its own i18n key', () => {
    expect(decisionErrorKey('incomplete-proposal')).toBe('decisionIncompleteProposal')
  })

  it('maps error to the generic i18n key', () => {
    expect(decisionErrorKey('error')).toBe('decisionError')
  })
})

describe('extractDecisionConflict', () => {
  it('reads a well-formed decision out of ApiError.details', () => {
    const error = new ApiError(409, 'Conflict', 'invalid-transition', {
      decision: {
        action: 'approved',
        decidedAt: '2026-01-05T12:00:00.000Z',
        decidedBy: { id: 'user-2', name: 'Grace Hopper' },
      },
    })

    expect(extractDecisionConflict(error)).toEqual({
      action: 'approved',
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    })
  })

  it('returns null when details.decision is explicitly null', () => {
    const error = new ApiError(409, 'Conflict', 'invalid-transition', { decision: null })

    expect(extractDecisionConflict(error)).toBeNull()
  })

  it('returns null when details has no decision field at all', () => {
    const error = new ApiError(409, 'Conflict', 'invalid-transition', {})

    expect(extractDecisionConflict(error)).toBeNull()
  })

  it('returns null when the decision shape is malformed', () => {
    const error = new ApiError(409, 'Conflict', 'invalid-transition', {
      decision: { action: 'approved' },
    })

    expect(extractDecisionConflict(error)).toBeNull()
  })

  it('returns null for a non-ApiError value', () => {
    expect(extractDecisionConflict(new Error('boom'))).toBeNull()
  })
})

describe('decisionConflictMessageKey', () => {
  it('maps an approved conflict to its own i18n key', () => {
    expect(decisionConflictMessageKey('approved')).toBe('decisionConflictApproved')
  })

  it('maps a rejected conflict to its own i18n key', () => {
    expect(decisionConflictMessageKey('rejected')).toBe('decisionConflictRejected')
  })
})
