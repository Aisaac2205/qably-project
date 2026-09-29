import { describe, it, expect } from 'vitest'
import { en, es } from '@qably/i18n'
import {
  classifyDecisionError,
  decisionErrorKey,
  decisionConflictMessageKey,
  extractConflictingCase,
  extractDecisionConflict,
  isApprovalConflictCode,
  type DecisionErrorCode,
} from '@/features/review-inbox/lib/decision-error'
import { ApiError } from '@/lib/api-client'
import { approvalConflictError, conflictingCaseFixture } from './approval-conflict-fixture'

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

  it.each([
    ['name-taken', conflictingCaseFixture],
    ['automation-key-taken', conflictingCaseFixture],
    ['publish-conflict', null],
  ] as const)('maps the real %s approval body to its own code', async (code, conflictingCase) => {
    const error = await approvalConflictError(code, conflictingCase)

    expect(classifyDecisionError(error)).toBe(code)
  })
})

describe('isApprovalConflictCode', () => {
  it.each(['name-taken', 'automation-key-taken', 'publish-conflict'] as const)(
    'recognizes %s as an approval conflict',
    (code) => {
      expect(isApprovalConflictCode(code)).toBe(true)
    },
  )

  it.each([
    'invalid-transition',
    'missing-evidence',
    'missing-suite',
    'incomplete-proposal',
    'error',
  ] as const)('does not treat %s as an approval conflict', (code) => {
    expect(isApprovalConflictCode(code)).toBe(false)
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

  it('maps automation-key-taken and publish-conflict to their own i18n keys', () => {
    expect(decisionErrorKey('automation-key-taken')).toBe('decisionAutomationKeyTaken')
    expect(decisionErrorKey('publish-conflict')).toBe('decisionPublishConflict')
  })

  it('picks the copy that names the conflicting case when one is known', () => {
    expect(decisionErrorKey('automation-key-taken', conflictingCaseFixture)).toBe(
      'decisionAutomationKeyTakenWithCase',
    )
  })

  it('keeps one title copy for name-taken, because the conflicting case carries the proposal title', () => {
    expect(decisionErrorKey('name-taken', conflictingCaseFixture)).toBe('decisionNameTaken')
  })

  it('keeps the copy without a case name when the conflicting case is null', () => {
    expect(decisionErrorKey('name-taken', null)).toBe('decisionNameTaken')
    expect(decisionErrorKey('automation-key-taken', null)).toBe('decisionAutomationKeyTaken')
  })

  it('ignores a conflicting case for codes whose copy never names one', () => {
    expect(decisionErrorKey('publish-conflict', conflictingCaseFixture)).toBe(
      'decisionPublishConflict',
    )
    expect(decisionErrorKey('error', conflictingCaseFixture)).toBe('decisionError')
  })
})

describe('decision error copy', () => {
  const codes: DecisionErrorCode[] = [
    'invalid-transition',
    'missing-evidence',
    'missing-suite',
    'name-taken',
    'automation-key-taken',
    'publish-conflict',
    'incomplete-proposal',
    'error',
  ]

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('has a string for every code, with and without a case, in %s', (_locale, dictionary) => {
    const aiReview = (dictionary as unknown as Record<string, Record<string, unknown>>).aiReview

    for (const code of codes) {
      for (const conflictingCase of [null, conflictingCaseFixture]) {
        const key = decisionErrorKey(code, conflictingCase)

        expect(typeof aiReview[key], `${code} -> ${key}`).toBe('string')
      }
    }
  })

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('interpolates the case name in the %s copy that names it', (_locale, dictionary) => {
    const aiReview = (dictionary as unknown as Record<string, Record<string, string>>).aiReview

    expect(aiReview[decisionErrorKey('automation-key-taken', conflictingCaseFixture)]).toContain(
      '{{name}}',
    )
  })

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('names the failed proposal in every %s approval conflict copy', (_locale, dictionary) => {
    const aiReview = (dictionary as unknown as Record<string, Record<string, string>>).aiReview
    const conflictCodes = codes.filter(isApprovalConflictCode)

    for (const code of conflictCodes) {
      for (const conflictingCase of [null, conflictingCaseFixture]) {
        const key = decisionErrorKey(code, conflictingCase)

        expect(aiReview[key], `${code} -> ${key}`).toContain('{{title}}')
      }
    }
  })

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('promises no automatic re-check in the %s automation key copy', (_locale, dictionary) => {
    const aiReview = (dictionary as unknown as Record<string, Record<string, string>>).aiReview

    for (const conflictingCase of [null, conflictingCaseFixture]) {
      const copy = aiReview[decisionErrorKey('automation-key-taken', conflictingCase)]

      expect(copy).not.toMatch(/re-check|reload|vuelve a revisar|recarga/i)
    }
  })

  it('uses the typographic quotes of the Spanish file, not angle quotes', () => {
    const aiReview = (es as unknown as Record<string, Record<string, string>>).aiReview

    for (const code of codes.filter(isApprovalConflictCode)) {
      for (const conflictingCase of [null, conflictingCaseFixture]) {
        expect(aiReview[decisionErrorKey(code, conflictingCase)]).not.toMatch(/[«»]/)
      }
    }
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

describe('extractConflictingCase', () => {
  it('reads the conflicting case out of the real approval body', async () => {
    const error = await approvalConflictError('name-taken', conflictingCaseFixture)

    expect(extractConflictingCase(error)).toEqual(conflictingCaseFixture)
  })

  it('returns null when the API sent conflictingCase: null', async () => {
    const error = await approvalConflictError('automation-key-taken', null)

    expect(extractConflictingCase(error)).toBeNull()
  })

  it('returns null when details has no conflictingCase field at all', () => {
    const error = new ApiError(409, 'Conflict', 'name-taken', {})

    expect(extractConflictingCase(error)).toBeNull()
  })

  it('returns null when the ApiError carries no details', () => {
    const error = new ApiError(409, 'Conflict', 'name-taken')

    expect(extractConflictingCase(error)).toBeNull()
  })

  it('returns null when the conflicting case is malformed', () => {
    const error = new ApiError(409, 'Conflict', 'name-taken', {
      conflictingCase: { id: 'case-1', name: 42 },
    })

    expect(extractConflictingCase(error)).toBeNull()
  })

  it('returns null for a non-ApiError value', () => {
    expect(extractConflictingCase(new Error('boom'))).toBeNull()
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
