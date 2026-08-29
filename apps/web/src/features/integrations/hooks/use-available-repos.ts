'use client'

import { useQuery } from '@tanstack/react-query'
import type { AvailableRepo } from '@qably/types'
import { listAvailableRepos } from '../api/connections.api'
import { connectionKeys } from '../lib/query-keys'

const EMPTY: AvailableRepo[] = []

export function useAvailableRepos() {
  const query = useQuery({
    queryKey: connectionKeys.availableRepos,
    queryFn: ({ signal }) => listAvailableRepos(signal),
  })

  return {
    repos: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
