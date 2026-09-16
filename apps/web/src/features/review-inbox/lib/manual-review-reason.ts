const REASON_KEYS: Record<string, string> = {
  'extraction-failed': 'manualReviewReasonExtractionFailed',
  'no-tests-found': 'manualReviewReasonNoTestsFound',
  'ai-not-enabled': 'manualReviewReasonAiNotEnabled',
  'automation-key-not-found': 'manualReviewReasonAutomationKeyNotFound',
  'quota-exhausted': 'manualReviewReasonQuotaExhausted',
  'extraction-incomplete': 'manualReviewReasonExtractionIncomplete',
  // AI-provider-originated reasons (see apps/api ProviderUnavailableReason) —
  // these must all resolve to a translated sentence, never fall through to
  // manualReviewReasonUnknown, which would interpolate the raw code/message.
  'not-configured': 'manualReviewReasonNotConfigured',
  'invalid-credentials': 'manualReviewReasonInvalidCredentials',
  'rate-limited': 'manualReviewReasonRateLimited',
  'provider-overloaded': 'manualReviewReasonProviderOverloaded',
  'empty-response': 'manualReviewReasonEmptyResponse',
  'invalid-json-response': 'manualReviewReasonInvalidJsonResponse',
  'schema-violation': 'manualReviewReasonSchemaViolation',
  'unknown-provider-error': 'manualReviewReasonUnknownProviderError',
}

export function manualReviewReasonKey(objective: string): string | null {
  return REASON_KEYS[objective.trim()] ?? null
}
