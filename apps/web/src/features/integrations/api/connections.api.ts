import type { AvailableRepo, RepoConnection } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateConnectionPayload {
  provider: 'GITHUB' | 'BITBUCKET'
  name: string
  repo: string
}

export function listConnections(
  signal?: AbortSignal,
): Promise<RepoConnection[]> {
  return apiRequest<RepoConnection[]>('/connections', { signal })
}

export function listAvailableRepos(
  signal?: AbortSignal,
): Promise<AvailableRepo[]> {
  return apiRequest<AvailableRepo[]>('/connections/available-repos', { signal })
}

export function createConnection(
  payload: CreateConnectionPayload,
): Promise<RepoConnection> {
  return apiRequest<RepoConnection>('/connections', {
    method: 'POST',
    body: payload,
  })
}
