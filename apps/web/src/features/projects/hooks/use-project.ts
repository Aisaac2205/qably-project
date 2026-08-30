'use client'

import { useQuery } from '@tanstack/react-query'
import { getProject } from '../api/projects.api'
import { projectKeys } from '../lib/query-keys'

export function useProject(id: string) {
  const query = useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: ({ signal }) => getProject(id, signal),
    enabled: id !== '',
  })

  return {
    project: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
