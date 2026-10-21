import { describe, expect, it } from 'vitest'
import type { ProposalDetail } from '@/features/review-inbox/api/review.api'
import {
  CASE_DOCUMENTING_REFETCH_MS,
  caseDocumentingRefetchInterval,
  isCaseBeingDocumented,
} from '@/features/review-inbox/lib/case-documenting'

function detail(
  documentation: { queuedAt: string | null; outcomeAt: string | null } | null,
  status: ProposalDetail['status'] = 'in_review',
): ProposalDetail {
  return {
    id: 'proposal-1',
    projectId: 'project-1',
    status,
    title: 'Empties the cart',
    objective: '',
    preconditions: [],
    steps: ['Open the cart'],
    expectedResult: '',
    priority: 'medium',
    evidenceId: 'evidence-1',
    evidenceTitle: '',
    needsManualReview: false,
    evidence: null,
    links: [],
    matchedCase:
      documentation === null
        ? null
        : { id: 'case-1', name: 'Empties the cart', suiteId: 'suite-1', suiteName: 'Cart', documentation },
    publishedVersion: null,
    source: null,
    recentRuns: [],
    decision: null,
  }
}

const queued = { queuedAt: '2026-10-20T10:00:00.000Z', outcomeAt: null }
const finished = { queuedAt: '2026-10-20T10:00:00.000Z', outcomeAt: '2026-10-20T10:01:00.000Z' }

describe('isCaseBeingDocumented', () => {
  it('is true while a run on the case is queued with no later outcome', () => {
    expect(isCaseBeingDocumented(detail(queued))).toBe(true)
  })

  it('is false once the run has an outcome', () => {
    expect(isCaseBeingDocumented(detail(finished))).toBe(false)
  })

  it('is false without a case, before the detail loads, or for a decided proposal', () => {
    expect(isCaseBeingDocumented(detail(null))).toBe(false)
    expect(isCaseBeingDocumented(undefined)).toBe(false)
    expect(isCaseBeingDocumented(detail(queued, 'approved'))).toBe(false)
  })
})

describe('caseDocumentingRefetchInterval', () => {
  it('polls every few seconds while the notice shows', () => {
    expect(caseDocumentingRefetchInterval(detail(queued))).toBe(CASE_DOCUMENTING_REFETCH_MS)
    expect(CASE_DOCUMENTING_REFETCH_MS).toBeLessThanOrEqual(5_000)
  })

  it('stops polling once the run has finished', () => {
    expect(caseDocumentingRefetchInterval(detail(finished))).toBe(false)
    expect(caseDocumentingRefetchInterval(undefined)).toBe(false)
  })
})
