import type { CiRunDetailRecord, CiRunsPageRecord } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface ListCiRunsParams {
  projectId: string
  limit?: number
  cursor?: string
}

export function listCiRuns(
  params: ListCiRunsParams,
  signal?: AbortSignal,
): Promise<CiRunsPageRecord> {
  const search = new URLSearchParams({ projectId: params.projectId })

  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.cursor !== undefined) search.set('cursor', params.cursor)

  return apiRequest<CiRunsPageRecord>(`/ci-runs?${search.toString()}`, { signal })
}

export function getCiRun(
  id: string,
  signal?: AbortSignal,
): Promise<CiRunDetailRecord> {
  return apiRequest<CiRunDetailRecord>(`/ci-runs/${encodeURIComponent(id)}`, {
    signal,
  })
}
