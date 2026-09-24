'use client'

import { useQuery } from '@tanstack/react-query'
import { getUsage } from '../api/organizations.api'
import { organizationKeys } from '../lib/query-keys'

export function useOrganizationUsage() {
  const query = useQuery({
    queryKey: organizationKeys.usage,
    queryFn: ({ signal }) => getUsage(signal),
  })

  return {
    usage: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
