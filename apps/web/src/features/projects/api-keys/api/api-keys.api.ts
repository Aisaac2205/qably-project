import type { ApiKey, ApiKeyWithSecret } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateApiKeyPayload {
  name: string
}

export function listApiKeys(
  projectId: string,
  signal?: AbortSignal,
): Promise<ApiKey[]> {
  return apiRequest<ApiKey[]>(`/projects/${projectId}/api-keys`, { signal })
}

export function createApiKey(
  projectId: string,
  payload: CreateApiKeyPayload,
): Promise<ApiKeyWithSecret> {
  return apiRequest<ApiKeyWithSecret>(`/projects/${projectId}/api-keys`, {
    method: 'POST',
    body: payload,
  })
}

export function revokeApiKey(projectId: string, id: string): Promise<ApiKey> {
  return apiRequest<ApiKey>(`/projects/${projectId}/api-keys/${id}/revoke`, {
    method: 'POST',
  })
}
