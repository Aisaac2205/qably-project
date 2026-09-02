'use client'

import { useQuery } from '@tanstack/react-query'
import { listApiKeys } from '../api/api-keys.api'
import { apiKeyKeys } from '../lib/query-keys'

export function useApiKeys(projectId: string) {
  const query = useQuery({
    queryKey: apiKeyKeys.list(projectId),
    queryFn: ({ signal }) => listApiKeys(projectId, signal),
    enabled: projectId !== '',
  })

  return {
    apiKeys: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
