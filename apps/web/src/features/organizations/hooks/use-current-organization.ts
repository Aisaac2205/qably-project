'use client'

import type { OrganizationSummary } from '@qably/types'
import { useOrganizations } from './use-organizations'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

export interface CurrentOrganizationResult {
  organization: OrganizationSummary | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Prefers the persisted active organization when it is still one of the
 * caller's memberships. Otherwise falls back to the earliest-joined
 * membership, which mirrors the api's own default when no
 * x-organization-id header is sent (/organizations lists memberships in
 * that same joinedAt order).
 */
export function useCurrentOrganization(): CurrentOrganizationResult {
  const { organizations, isLoading, isError, error } = useOrganizations()
  const activeOrganizationId = useActiveOrganizationStore((state) => state.organizationId)

  const activeOrganization = activeOrganizationId
    ? organizations.find((organization) => organization.id === activeOrganizationId)
    : undefined

  return {
    organization: activeOrganization ?? organizations[0],
    isLoading,
    isError,
    error,
  }
}
