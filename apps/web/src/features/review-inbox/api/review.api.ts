import type {
  Evidence,
  ExtractedProposal,
  ProposalStatus,
  TraceabilityLink,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface ProposalFilters {
  projectId?: string
  status?: ProposalStatus
  duplicatesOnly?: boolean
  search?: string
}

export interface ProposalListItem extends ExtractedProposal {
  evidenceTitle: string
}

export interface ProposalDetail extends ProposalListItem {
  evidence: Evidence | null
  links: TraceabilityLink[]
}

export interface ApprovalResult {
  createdNewCase: boolean
  testCaseId: string
  versionId: string
  version: number
  decisionId: string
}

export interface RejectionResult {
  decisionId: string
}

function buildQuery(filters: ProposalFilters): string {
  const params = new URLSearchParams()

  if (filters.projectId !== undefined) params.set('projectId', filters.projectId)
  if (filters.status !== undefined) params.set('status', filters.status)
  if (filters.duplicatesOnly === true) params.set('duplicatesOnly', 'true')
  if (filters.search !== undefined) params.set('search', filters.search)

  const query = params.toString()

  return query === '' ? '' : `?${query}`
}

export function listProposals(
  filters: ProposalFilters,
  signal?: AbortSignal,
): Promise<ProposalListItem[]> {
  return apiRequest<ProposalListItem[]>(
    `/review/proposals${buildQuery(filters)}`,
    { signal },
  )
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
