import type { CasePriority, CaseState, Suite } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateSuitePayload {
  projectId: string
  name: string
  description?: string
  tags?: string[]
  isDefault?: boolean
}

export type UpdateSuitePayload = Partial<{
  name: string
  description: string
  tags: string[]
  isDefault: boolean
}>

export interface CreateCasePayload {
  name: string
  steps?: string[]
  expectedResult?: string
  priority?: CasePriority
  state?: CaseState
}

export type UpdateCasePayload = Partial<{
  name: string
  steps: string[]
  expectedResult: string
  priority: CasePriority
  state: CaseState
}>

export function listSuites(
  projectId?: string,
  signal?: AbortSignal,
): Promise<Suite[]> {
  const query =
    projectId === undefined
      ? ''
      : `?projectId=${encodeURIComponent(projectId)}`

  return apiRequest<Suite[]>(`/suites${query}`, { signal })
}

export function getSuite(id: string, signal?: AbortSignal): Promise<Suite> {
  return apiRequest<Suite>(`/suites/${id}`, { signal })
}

export function createSuite(payload: CreateSuitePayload): Promise<Suite> {
  return apiRequest<Suite>('/suites', { method: 'POST', body: payload })
}

export function updateSuite(
  id: string,
  payload: UpdateSuitePayload,
): Promise<Suite> {
  return apiRequest<Suite>(`/suites/${id}`, { method: 'PATCH', body: payload })
}

export function deleteSuite(id: string): Promise<void> {
  return apiRequest<void>(`/suites/${id}`, { method: 'DELETE' })
}

export function createCase(
  suiteId: string,
  payload: CreateCasePayload,
): Promise<Suite> {
  return apiRequest<Suite>(`/suites/${suiteId}/cases`, {
    method: 'POST',
    body: payload,
  })
}

export function updateCase(
  suiteId: string,
  caseId: string,
  payload: UpdateCasePayload,
): Promise<Suite> {
  return apiRequest<Suite>(`/suites/${suiteId}/cases/${caseId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteCase(suiteId: string, caseId: string): Promise<Suite> {
  return apiRequest<Suite>(`/suites/${suiteId}/cases/${caseId}`, {
    method: 'DELETE',
  })
}
