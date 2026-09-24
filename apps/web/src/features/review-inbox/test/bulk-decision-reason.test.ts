import { describe, expect, it } from 'vitest'
import { bulkDecisionReasonKey, formatBulkSummary, summarizeBulkResults } from '../lib/bulk-decision-reason'

function fakeT(key: string, params?: Record<string, string | number>): string {
  if (key === 'reviewInbox.bulkApproveSummary') return `Approved ${params?.approved}, skipped ${params?.skipped}`
  if (key === 'reviewInbox.bulkRejectSummary') return `Rejected ${params?.rejected}, skipped ${params?.skipped}`
  if (key === 'reviewInbox.bulkSkipReason') return `${params?.count} ${params?.reason}`
  if (key.startsWith('reviewInbox.bulkReason')) return key.replace('reviewInbox.', '')
  return key
}

describe('bulkDecisionReasonKey', () => {
  it('maps every ReviewError code to a translation key', () => {
    expect(bulkDecisionReasonKey('incomplete-proposal')).toBe('bulkReasonIncompleteProposal')
    expect(bulkDecisionReasonKey('missing-evidence')).toBe('bulkReasonMissingEvidence')
    expect(bulkDecisionReasonKey('missing-suite')).toBe('bulkReasonMissingSuite')
    expect(bulkDecisionReasonKey('name-taken')).toBe('bulkReasonNameTaken')
    expect(bulkDecisionReasonKey('invalid-transition')).toBe('bulkReasonInvalidTransition')
    expect(bulkDecisionReasonKey('not-found')).toBe('bulkReasonNotFound')
  })
})

describe('summarizeBulkResults', () => {
  it('counts successes separately from skips', () => {
    const summary = summarizeBulkResults([
      { id: '1', outcome: 'approved' },
      { id: '2', outcome: 'approved' },
      { id: '3', outcome: 'skipped', reason: 'incomplete-proposal' },
    ])

    expect(summary.succeeded).toBe(2)
    expect(summary.skipped).toBe(1)
  })

  it('groups skip counts by reason', () => {
    const summary = summarizeBulkResults([
      { id: '1', outcome: 'skipped', reason: 'incomplete-proposal' },
      { id: '2', outcome: 'skipped', reason: 'incomplete-proposal' },
      { id: '3', outcome: 'skipped', reason: 'missing-evidence' },
    ])

    expect(summary.skippedByReason).toEqual(
      expect.arrayContaining([
        { reason: 'incomplete-proposal', count: 2 },
        { reason: 'missing-evidence', count: 1 },
      ]),
    )
  })

  it('reports zero skips for an all-success batch', () => {
    const summary = summarizeBulkResults([{ id: '1', outcome: 'rejected' }])

    expect(summary).toEqual({ succeeded: 1, skipped: 0, skippedByReason: [] })
  })
})

describe('formatBulkSummary', () => {
  it('formats an approve summary with no skip reasons', () => {
    const message = formatBulkSummary(
      fakeT,
      [
        { id: '1', outcome: 'approved' },
        { id: '2', outcome: 'approved' },
      ],
      'approve',
    )

    expect(message).toBe('Approved 2, skipped 0')
  })

  it('formats a reject summary and appends skip reasons in parentheses', () => {
    const message = formatBulkSummary(
      fakeT,
      [
        { id: '1', outcome: 'rejected' },
        { id: '2', outcome: 'skipped', reason: 'incomplete-proposal' },
      ],
      'reject',
    )

    expect(message).toBe('Rejected 1, skipped 1 (1 bulkReasonIncompleteProposal)')
  })
})
