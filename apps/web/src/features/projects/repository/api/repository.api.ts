import type { ProjectRepositoryView } from '@qably/types'
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
