'use client'

import type { OrganizationSummary } from '@qably/types'
import { useOrganizations } from './use-organizations'

export interface CurrentOrganizationResult {
  organization: OrganizationSummary | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * The api resolves the default organization as the caller's earliest-joined
 * membership when no x-organization-id header is sent, and /organizations
 * lists memberships in that same joinedAt order — so the first entry here
 * mirrors the api's own default without a second endpoint or header.
 */
export function useCurrentOrganization(): CurrentOrganizationResult {
  const { organizations, isLoading, isError, error } = useOrganizations()

  return {
    organization: organizations[0],
    isLoading,
    isError,
    error,
  }
}
