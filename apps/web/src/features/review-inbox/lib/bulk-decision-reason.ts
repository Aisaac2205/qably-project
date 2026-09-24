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

export type BulkDecisionKind = 'approve' | 'reject'

export function formatBulkSummary(
  t: (key: string, params?: Record<string, string | number>) => string,
  results: BulkDecisionItemResult[],
  kind: BulkDecisionKind,
): string {
  const summary = summarizeBulkResults(results)
  const base = t(kind === 'approve' ? 'reviewInbox.bulkApproveSummary' : 'reviewInbox.bulkRejectSummary', {
    approved: summary.succeeded,
    rejected: summary.succeeded,
    skipped: summary.skipped,
  })
  const reasons = summary.skippedByReason
    .map(({ reason, count }) =>
      t('reviewInbox.bulkSkipReason', { count, reason: t(`reviewInbox.${bulkDecisionReasonKey(reason)}`) }),
    )
    .join(', ')

  return reasons ? `${base} (${reasons})` : base
}
