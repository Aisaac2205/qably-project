'use client'

import { useQuery } from '@tanstack/react-query'
import type { OrganizationSummary } from '@qably/types'
import { listOrganizations } from '../api/organizations.api'
import { organizationKeys } from '../lib/query-keys'

const EMPTY: OrganizationSummary[] = []

export function useOrganizations() {
  const query = useQuery({
    queryKey: organizationKeys.all,
    queryFn: ({ signal }) => listOrganizations(signal),
  })

  return {
    organizations: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
