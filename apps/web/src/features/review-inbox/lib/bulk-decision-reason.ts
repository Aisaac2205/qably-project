import type { BulkDecisionErrorCode, BulkDecisionItemResult } from '../api/review.api'

const REASON_KEYS: Record<BulkDecisionErrorCode, string> = {
  'not-found': 'bulkReasonNotFound',
  'invalid-transition': 'bulkReasonInvalidTransition',
  'missing-evidence': 'bulkReasonMissingEvidence',
  'incomplete-proposal': 'bulkReasonIncompleteProposal',
  'missing-suite': 'bulkReasonMissingSuite',
  'name-taken': 'bulkReasonNameTaken',
}

export function bulkDecisionReasonKey(reason: BulkDecisionErrorCode): string {
  return REASON_KEYS[reason]
}

export interface BulkDecisionReasonCount {
  reason: BulkDecisionErrorCode
  count: number
}

export interface BulkDecisionSummary {
  succeeded: number
  skipped: number
  skippedByReason: BulkDecisionReasonCount[]
}

export function summarizeBulkResults(results: BulkDecisionItemResult[]): BulkDecisionSummary {
  const skippedResults = results.filter((r) => r.outcome === 'skipped')
  const counts = new Map<BulkDecisionErrorCode, number>()

  for (const result of skippedResults) {
    if (result.reason === undefined) continue
    counts.set(result.reason, (counts.get(result.reason) ?? 0) + 1)
  }

  return {
    succeeded: results.length - skippedResults.length,
    skipped: skippedResults.length,
    skippedByReason: Array.from(counts.entries()).map(([reason, count]) => ({ reason, count })),
  }
}
