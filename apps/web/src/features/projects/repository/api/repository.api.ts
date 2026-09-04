import type { ProjectRepositoryView, WebhookSecretView } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function getProjectRepository(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectRepositoryView> {
  return apiRequest<ProjectRepositoryView>(
    `/projects/${projectId}/repository`,
    { signal },
  )
}

export function rotateWebhookSecret(
  projectId: string,
): Promise<WebhookSecretView> {
  return apiRequest<WebhookSecretView>(
    `/projects/${projectId}/repository/webhook-secret`,
    { method: 'POST' },
  )
}
