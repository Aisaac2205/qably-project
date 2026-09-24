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

  it('maps every source-unavailable reason the repository source reader can emit', () => {
    expect(extractionFailureReasonKey('no-connection')).toBe(
      'manualReviewReasonNoConnection',
    )
    expect(extractionFailureReasonKey('timeout')).toBe('manualReviewReasonTimeout')
    expect(extractionFailureReasonKey('fetch-failed')).toBe(
      'manualReviewReasonFetchFailed',
    )
  })

  it('maps a 401 or 403 http status to the permission-denied key', () => {
    expect(extractionFailureReasonKey('http-401')).toBe(
      'manualReviewReasonHttpForbidden',
    )
    expect(extractionFailureReasonKey('http-403')).toBe(
      'manualReviewReasonHttpForbidden',
    )
  })

  it('maps a 404 http status to the file-not-found key', () => {
    expect(extractionFailureReasonKey('http-404')).toBe(
      'manualReviewReasonHttpNotFound',
    )
  })

  it('maps any other http status to a generic http-error key', () => {
    expect(extractionFailureReasonKey('http-500')).toBe('manualReviewReasonHttpError')
    expect(extractionFailureReasonKey('http-503')).toBe('manualReviewReasonHttpError')
    expect(extractionFailureReasonKey('http-418')).toBe('manualReviewReasonHttpError')
  })

  it('returns null only for a truly unrecognized value, e.g. an empty string', () => {
    expect(extractionFailureReasonKey('')).toBeNull()
    expect(extractionFailureReasonKey('something nobody wrote')).toBeNull()
    expect(extractionFailureReasonKey('http-40')).toBeNull()
    expect(extractionFailureReasonKey('http-4000')).toBeNull()
  })
})
