import type { RepoConnection } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function listConnections(
  signal?: AbortSignal,
): Promise<RepoConnection[]> {
  return apiRequest<RepoConnection[]>('/connections', { signal })
}
