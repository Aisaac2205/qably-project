import type {
  CaseStatus,
  PushPassRateRecord,
  RegressionsRecord,
  RunRecord,
  RunsPageRecord,
  RunSource,
  SuiteMetricsRecord,
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
  days?: number
  ungrouped?: boolean
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
  if (params.days !== undefined) search.set('days', String(params.days))
  if (params.ungrouped === true) search.set('ungrouped', 'true')

  const query = search.size === 0 ? '' : `?${search.toString()}`

  return apiRequest<RunsPageRecord>(`/runs${query}`, { signal })
}

export function getPushPassRate(
  projectId: string,
  days?: number,
  signal?: AbortSignal,
): Promise<PushPassRateRecord> {
  const search = new URLSearchParams({ projectId })
  if (days !== undefined) search.set('days', String(days))

  return apiRequest<PushPassRateRecord>(
    `/runs/push-pass-rate?${search.toString()}`,
    { signal },
  )
}

export function getSuiteMetrics(
  projectId: string,
  signal?: AbortSignal,
): Promise<SuiteMetricsRecord> {
  return apiRequest<SuiteMetricsRecord>(
    `/runs/suite-metrics?projectId=${encodeURIComponent(projectId)}`,
    { signal },
  )
}

export function getRegressions(
  projectId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<RegressionsRecord> {
  const search = new URLSearchParams({ projectId })
  if (limit !== undefined) search.set('limit', String(limit))

  return apiRequest<RegressionsRecord>(`/runs/regressions?${search.toString()}`, {
    signal,
  })
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
