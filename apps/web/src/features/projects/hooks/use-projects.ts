'use client'

import { useQuery } from '@tanstack/react-query'
import type { ProjectListItem } from '@qably/types'
import { listProjects } from '../api/projects.api'
import { projectKeys } from '../lib/query-keys'

const EMPTY: ProjectListItem[] = []

export function useProjects() {
  const query = useQuery({
    queryKey: projectKeys.all,
    queryFn: ({ signal }) => listProjects(signal),
  })

  return {
    projects: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
