import type {
  AvailableRepo,
  DetectedStack,
  RepoConnection,
} from '@qably/types'
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

export function detectStack(
  repo: string,
  signal?: AbortSignal,
): Promise<DetectedStack> {
  return apiRequest<DetectedStack>(
    `/connections/detect-stack?repo=${encodeURIComponent(repo)}`,
    { signal },
  )
}

export function createConnection(
  payload: CreateConnectionPayload,
): Promise<RepoConnection> {
  return apiRequest<RepoConnection>('/connections', {
    method: 'POST',
    body: payload,
  })
}
