import type {
  CaseStatus,
  RunRecord,
  RunsPageRecord,
  RunSource,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateRunPayload {
  projectId: string
  suiteId: string
  name?: string
}

export interface UpdateRunCasePayload {
  status: CaseStatus
}

export interface ListRunsParams {
  projectId?: string
  source?: RunSource
  limit?: number
  cursor?: string
}

export function listRuns(
  params: ListRunsParams = {},
  signal?: AbortSignal,
): Promise<RunsPageRecord> {
  const search = new URLSearchParams()

  if (params.projectId !== undefined) search.set('projectId', params.projectId)
  if (params.source !== undefined) search.set('source', params.source)
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.cursor !== undefined) search.set('cursor', params.cursor)

  const query = search.size === 0 ? '' : `?${search.toString()}`

  return apiRequest<RunsPageRecord>(`/runs${query}`, { signal })
}

export function getRun(id: string, signal?: AbortSignal): Promise<RunRecord> {
  return apiRequest<RunRecord>(`/runs/${id}`, { signal })
}

export function createRun(payload: CreateRunPayload): Promise<RunRecord> {
  return apiRequest<RunRecord>('/runs', { method: 'POST', body: payload })
}

export function updateRunCase(
  runId: string,
  caseId: string,
  payload: UpdateRunCasePayload,
): Promise<RunRecord> {
  return apiRequest<RunRecord>(`/runs/${runId}/cases/${caseId}`, {
    method: 'PATCH',
    body: payload,
  })
}
