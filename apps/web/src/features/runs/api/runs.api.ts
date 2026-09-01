import type { CaseStatus, RunRecord, RunSummaryRecord } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateRunPayload {
  projectId: string
  suiteId: string
  name?: string
}

export interface UpdateRunCasePayload {
  status: CaseStatus
}

export function listRuns(
  projectId?: string,
  signal?: AbortSignal,
): Promise<RunSummaryRecord[]> {
  const query =
    projectId === undefined
      ? ''
      : `?projectId=${encodeURIComponent(projectId)}`

  return apiRequest<RunSummaryRecord[]>(`/runs${query}`, { signal })
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
