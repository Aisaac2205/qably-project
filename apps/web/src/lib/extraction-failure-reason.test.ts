import { describe, expect, it } from 'vitest'
import { extractionFailureReasonKey } from './extraction-failure-reason'

describe('extractionFailureReasonKey', () => {
  it('maps every reason the extraction processor writes', () => {
    expect(extractionFailureReasonKey('extraction-failed')).toBe(
      'manualReviewReasonExtractionFailed',
    )
    expect(extractionFailureReasonKey('no-tests-found')).toBe(
      'manualReviewReasonNoTestsFound',
    )
    expect(extractionFailureReasonKey('ai-not-enabled')).toBe(
      'manualReviewReasonAiNotEnabled',
    )
    expect(extractionFailureReasonKey('automation-key-not-found')).toBe(
      'manualReviewReasonAutomationKeyNotFound',
    )
    expect(extractionFailureReasonKey('quota-exhausted')).toBe(
      'manualReviewReasonQuotaExhausted',
    )
    expect(extractionFailureReasonKey('extraction-incomplete')).toBe(
      'manualReviewReasonExtractionIncomplete',
    )
  })

  it('maps every AI-provider reason the extractor can emit, never leaving one to fall through to the raw-text fallback', () => {
    expect(extractionFailureReasonKey('not-configured')).toBe(
      'manualReviewReasonNotConfigured',
    )
    expect(extractionFailureReasonKey('invalid-credentials')).toBe(
      'manualReviewReasonInvalidCredentials',
    )
    expect(extractionFailureReasonKey('rate-limited')).toBe(
      'manualReviewReasonRateLimited',
    )
    expect(extractionFailureReasonKey('provider-overloaded')).toBe(
      'manualReviewReasonProviderOverloaded',
    )
    expect(extractionFailureReasonKey('empty-response')).toBe(
      'manualReviewReasonEmptyResponse',
    )
    expect(extractionFailureReasonKey('invalid-json-response')).toBe(
      'manualReviewReasonInvalidJsonResponse',
    )
    expect(extractionFailureReasonKey('schema-violation')).toBe(
      'manualReviewReasonSchemaViolation',
    )
    expect(extractionFailureReasonKey('unknown-provider-error')).toBe(
      'manualReviewReasonUnknownProviderError',
    )
  })

  it('returns null only for a truly unrecognized value, e.g. an empty string', () => {
    expect(extractionFailureReasonKey('')).toBeNull()
    expect(extractionFailureReasonKey('something nobody wrote')).toBeNull()
  })
})
