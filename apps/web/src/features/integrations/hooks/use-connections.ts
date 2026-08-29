'use client'

import { useQuery } from '@tanstack/react-query'
import type { RepoConnection } from '@qably/types'
import { listConnections } from '../api/connections.api'
import { connectionKeys } from '../lib/query-keys'

const EMPTY: RepoConnection[] = []

export function useConnections() {
  const query = useQuery({
    queryKey: connectionKeys.all,
    queryFn: ({ signal }) => listConnections(signal),
  })

  return {
    connections: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
