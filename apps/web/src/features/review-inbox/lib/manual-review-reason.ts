const REASON_KEYS: Record<string, string> = {
  'extraction-failed': 'manualReviewReasonExtractionFailed',
  'no-tests-found': 'manualReviewReasonNoTestsFound',
  'ai-not-enabled': 'manualReviewReasonAiNotEnabled',
  'automation-key-not-found': 'manualReviewReasonAutomationKeyNotFound',
  'quota-exhausted': 'manualReviewReasonQuotaExhausted',
}

export function manualReviewReasonKey(objective: string): string | null {
  return REASON_KEYS[objective.trim()] ?? null
}
