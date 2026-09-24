import type { OrganizationSummary, OrganizationUsageRecord } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function listOrganizations(
  signal?: AbortSignal,
): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>('/organizations', { signal })
}

export function getUsage(
  signal?: AbortSignal,
): Promise<OrganizationUsageRecord> {
  return apiRequest<OrganizationUsageRecord>('/organizations/current/usage', { signal })
}
