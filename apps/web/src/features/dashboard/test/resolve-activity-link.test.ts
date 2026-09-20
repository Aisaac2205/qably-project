import { describe, expect, it } from 'vitest'
import type { CiCommitActivityRecord, ExtractedProposal, RunSummaryRecord } from '@qably/types'
import {
  resolveCiCommitLink,
  resolveProposalLink,
  resolveRunLink,
} from '@/features/dashboard/lib/resolve-activity-link'

function run(overrides: Partial<RunSummaryRecord> = {}): RunSummaryRecord {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    suiteName: 'Checkout',
    name: 'Checkout smoke',
    status: 'pass',
    source: 'manual',
    externalId: 'ext-1',
    reportExternalId: 'ext-1',
    startedAt: '2026-06-16T10:00:00Z',
    caseCounts: { total: 0, pending: 0, running: 0, pass: 0, fail: 0, skip: 0, blocked: 0 },
    passRate: 1,
    delta: null,
    ...overrides,
  }
}

function proposal(overrides: Partial<ExtractedProposal> = {}): ExtractedProposal {
  return {
    id: 'proposal-1',
    projectId: 'proj-1',
    status: 'in_review',
    title: 'Add checkout case',
    objective: 'Cover checkout',
    preconditions: [],
    steps: [],
    expectedResult: 'Order completes',
    priority: 'medium',
    evidenceId: 'evidence-1',
    needsManualReview: false,
    ...overrides,
  }
}

function ciCommit(overrides: Partial<CiCommitActivityRecord> = {}): CiCommitActivityRecord {
  return {
    commitSha: 'abc123',
    shortSha: 'abc123',
    status: 'pass',
    lastRunAt: '2026-06-16T10:00:00Z',
    runCount: 2,
    passedRunCount: 2,
    ...overrides,
  }
}

describe('resolveRunLink', () => {
  it('links to the run detail page for its project', () => {
    expect(resolveRunLink(run({ projectId: 'proj-9', id: 'run-9' }))).toBe(
      '/projects/proj-9/runs/run-9',
    )
  })
})

describe('resolveProposalLink', () => {
  it('links to the review inbox preselecting the proposal', () => {
    expect(resolveProposalLink(proposal({ id: 'proposal-9' }))).toBe(
      '/review-inbox?proposal=proposal-9',
    )
  })
})

describe('resolveCiCommitLink', () => {
  it('always returns undefined — CiCommitActivityRecord carries no projectId to link to', () => {
    expect(resolveCiCommitLink(ciCommit())).toBeUndefined()
  })
})
