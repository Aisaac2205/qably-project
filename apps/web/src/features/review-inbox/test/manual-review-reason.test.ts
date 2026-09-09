import { describe, expect, it } from 'vitest'
import { manualReviewReasonKey } from '../lib/manual-review-reason'

describe('manualReviewReasonKey', () => {
  it('maps every reason the extraction processor writes', () => {
    expect(manualReviewReasonKey('extraction-failed')).toBe(
      'manualReviewReasonExtractionFailed',
    )
    expect(manualReviewReasonKey('no-tests-found')).toBe(
      'manualReviewReasonNoTestsFound',
    )
    expect(manualReviewReasonKey('ai-not-enabled')).toBe(
      'manualReviewReasonAiNotEnabled',
    )
    expect(manualReviewReasonKey('automation-key-not-found')).toBe(
      'manualReviewReasonAutomationKeyNotFound',
    )
  })

  it('returns null for a provider message it cannot translate', () => {
    expect(manualReviewReasonKey('invalid-credentials')).toBeNull()
    expect(manualReviewReasonKey('')).toBeNull()
  })
})
