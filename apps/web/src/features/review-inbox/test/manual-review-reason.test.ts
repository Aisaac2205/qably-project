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
    expect(manualReviewReasonKey('quota-exhausted')).toBe(
      'manualReviewReasonQuotaExhausted',
    )
    expect(manualReviewReasonKey('extraction-incomplete')).toBe(
      'manualReviewReasonExtractionIncomplete',
    )
  })

  it('maps every AI-provider reason the extractor can emit, never leaving one to fall through to the raw-text fallback', () => {
    expect(manualReviewReasonKey('not-configured')).toBe(
      'manualReviewReasonNotConfigured',
    )
    expect(manualReviewReasonKey('invalid-credentials')).toBe(
      'manualReviewReasonInvalidCredentials',
    )
    expect(manualReviewReasonKey('rate-limited')).toBe(
      'manualReviewReasonRateLimited',
    )
    expect(manualReviewReasonKey('provider-overloaded')).toBe(
      'manualReviewReasonProviderOverloaded',
    )
    expect(manualReviewReasonKey('empty-response')).toBe(
      'manualReviewReasonEmptyResponse',
    )
    expect(manualReviewReasonKey('invalid-json-response')).toBe(
      'manualReviewReasonInvalidJsonResponse',
    )
    expect(manualReviewReasonKey('schema-violation')).toBe(
      'manualReviewReasonSchemaViolation',
    )
    expect(manualReviewReasonKey('unknown-provider-error')).toBe(
      'manualReviewReasonUnknownProviderError',
    )
  })

  it('returns null only for a truly unrecognized value, e.g. an empty string', () => {
    expect(manualReviewReasonKey('')).toBeNull()
    expect(manualReviewReasonKey('something nobody wrote')).toBeNull()
  })
})
