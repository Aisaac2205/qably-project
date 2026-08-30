'use client'

import { useQuery } from '@tanstack/react-query'
import { getProjectRepository } from '../api/repository.api'
import { projectKeys } from '../../lib/query-keys'

export function useProjectRepository(projectId: string) {
  const query = useQuery({
    queryKey: projectKeys.repository(projectId),
    queryFn: ({ signal }) => getProjectRepository(projectId, signal),
    enabled: projectId !== '',
  })

  return {
    repository: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
