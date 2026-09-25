import type {
  CaseStatus,
  Evidence,
  ExtractedProposal,
  ProposalStatus,
  TraceabilityLink,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export type ProposalDuplicateKind = 'none' | 'update' | 'possible_duplicate'

export type DuplicateReason =
  | 'same-automation-key'
  | 'same-title'
  | 'title-overlap'
  | 'steps-overlap'
  | 'expected-result-overlap'
  | 'cross-suite-key'

export interface ProposalClassification {
  kind: ProposalDuplicateKind
  matchedCaseId: string | null
  matchedCaseName: string | null
  score: number | null
  reasons: DuplicateReason[]
}

export interface InboxSuite {
  id: string
  name: string
}

export interface ProposalListItem extends ExtractedProposal {
  evidenceTitle: string
  suite?: InboxSuite | null
  classification?: ProposalClassification
}

export interface MatchedCaseView {
  id: string
  name: string
  suiteId: string
  suiteName: string
}

export interface PublishedVersionView {
  version: number
  title: string
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
  publishedAt: string
  publishedBy: { id: string; name: string } | null
}

export interface ProposalSourceView {
  filePath: string
  uri: string
  commitSha: string | null
  pullRequestNumber: number | null
}

export interface RecentRunView {
  runId: string
  status: CaseStatus
  recordedAt: string
}

export interface LastDecisionView {
  action: 'approved' | 'rejected'
  decidedAt: string
  decidedBy: { id: string; name: string }
}

export interface ProposalDetail extends ProposalListItem {
  evidence: Evidence | null
  links: TraceabilityLink[]
  matchedCase: MatchedCaseView | null
  publishedVersion: PublishedVersionView | null
  source: ProposalSourceView | null
  recentRuns: RecentRunView[]
  decision: LastDecisionView | null
}

export interface ApprovalResult {
  createdNewCase: boolean
  testCaseId: string
  testCaseName: string
  suiteId: string | null
  versionId: string
  version: number
  decisionId: string
}

export interface RejectionResult {
  decisionId: string
}

export type ReviewInboxStatusFilter = ProposalStatus | 'all'

export interface ReviewInboxFilters {
  projectId?: string
  status: ReviewInboxStatusFilter
  duplicatesOnly?: boolean
  search?: string
}

export interface ReviewInboxPageResult {
  items: ProposalListItem[]
  nextCursor: string | null
}

export interface ReviewInboxCountsFilters {
  projectId?: string
  search?: string
}

export type ReviewInboxStatusCounts = Record<
  'in_review' | 'approved' | 'rejected' | 'changes_requested',
  number
>

export interface ReviewInboxCountsResult {
  byStatus: ReviewInboxStatusCounts
  openCollisions: number
  version: string
}

function buildInboxPageQuery(
  filters: ReviewInboxFilters,
  cursor: string | null,
  limit: number,
): string {
  const params = new URLSearchParams()

  if (filters.projectId !== undefined) params.set('projectId', filters.projectId)
  params.set('status', filters.status)
  if (filters.duplicatesOnly === true) params.set('duplicatesOnly', 'true')
  if (filters.search !== undefined && filters.search.trim() !== '') {
    params.set('search', filters.search)
  }
  if (cursor !== null) params.set('cursor', cursor)
  params.set('limit', String(limit))

  return `?${params.toString()}`
}

function buildInboxCountsQuery(filters: ReviewInboxCountsFilters): string {
  const params = new URLSearchParams()

  if (filters.projectId !== undefined) params.set('projectId', filters.projectId)
  if (filters.search !== undefined && filters.search.trim() !== '') {
    params.set('search', filters.search)
  }

  const query = params.toString()

  return query === '' ? '' : `?${query}`
}

export function getProposal(
  id: string,
  signal?: AbortSignal,
): Promise<ProposalDetail> {
  return apiRequest<ProposalDetail>(`/review/proposals/${id}`, { signal })
}

export function approveProposal(
  id: string,
  comment?: string,
): Promise<ApprovalResult> {
  return apiRequest<ApprovalResult>(`/review/proposals/${id}/approve`, {
    method: 'POST',
    body: comment === undefined ? {} : { comment },
  })
}

export function rejectProposal(
  id: string,
  comment?: string,
): Promise<RejectionResult> {
  return apiRequest<RejectionResult>(`/review/proposals/${id}/reject`, {
    method: 'POST',
    body: comment === undefined ? {} : { comment },
  })
}

export function getInboxPage(
  filters: ReviewInboxFilters,
  cursor: string | null,
  limit: number,
  signal?: AbortSignal,
): Promise<ReviewInboxPageResult> {
  return apiRequest<ReviewInboxPageResult>(
    `/review/inbox${buildInboxPageQuery(filters, cursor, limit)}`,
    { signal },
  )
}

export function getInboxCounts(
  filters: ReviewInboxCountsFilters,
  signal?: AbortSignal,
): Promise<ReviewInboxCountsResult> {
  return apiRequest<ReviewInboxCountsResult>(
    `/review/inbox/counts${buildInboxCountsQuery(filters)}`,
    { signal },
  )
}
