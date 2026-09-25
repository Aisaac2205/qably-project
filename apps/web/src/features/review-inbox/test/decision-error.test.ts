import { describe, it, expect } from 'vitest'
import {
  classifyDecisionError,
  decisionErrorKey,
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
