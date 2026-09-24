const REASON_KEYS: Record<string, string> = {
  'extraction-failed': 'manualReviewReasonExtractionFailed',
  'no-tests-found': 'manualReviewReasonNoTestsFound',
  'ai-not-enabled': 'manualReviewReasonAiNotEnabled',
  'automation-key-not-found': 'manualReviewReasonAutomationKeyNotFound',
  'quota-exhausted': 'manualReviewReasonQuotaExhausted',
  'extraction-incomplete': 'manualReviewReasonExtractionIncomplete',
  'not-configured': 'manualReviewReasonNotConfigured',
  'invalid-credentials': 'manualReviewReasonInvalidCredentials',
  'rate-limited': 'manualReviewReasonRateLimited',
  'provider-overloaded': 'manualReviewReasonProviderOverloaded',
  'empty-response': 'manualReviewReasonEmptyResponse',
  'invalid-json-response': 'manualReviewReasonInvalidJsonResponse',
  'schema-violation': 'manualReviewReasonSchemaViolation',
  'unknown-provider-error': 'manualReviewReasonUnknownProviderError',
  'no-connection': 'manualReviewReasonNoConnection',
  timeout: 'manualReviewReasonTimeout',
  'fetch-failed': 'manualReviewReasonFetchFailed',
}

const HTTP_STATUS_PATTERN = /^http-(\d{3})$/

export function extractionFailureReasonKey(objective: string): string | null {
  const reason = objective.trim()
  const direct = REASON_KEYS[reason]
  if (direct !== undefined) return direct

  const httpMatch = HTTP_STATUS_PATTERN.exec(reason)
  if (httpMatch === null) return null

  const status = httpMatch[1]
  if (status === '401' || status === '403') return 'manualReviewReasonHttpForbidden'
  if (status === '404') return 'manualReviewReasonHttpNotFound'
  return 'manualReviewReasonHttpError'
}
