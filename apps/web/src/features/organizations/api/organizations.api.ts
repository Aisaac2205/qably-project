import type { OrganizationSummary } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function listOrganizations(
  signal?: AbortSignal,
): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>('/organizations', { signal })
}
