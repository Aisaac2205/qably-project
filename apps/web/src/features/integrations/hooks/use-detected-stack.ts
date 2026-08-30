'use client'

import { useQuery } from '@tanstack/react-query'
import { detectStack } from '../api/connections.api'
import { connectionKeys } from '../lib/query-keys'

const EMPTY: string[] = []

export function useDetectedStack(repo: string | null) {
  const query = useQuery({
    queryKey: connectionKeys.stack(repo ?? ''),
    queryFn: ({ signal }) => detectStack(repo ?? '', signal),
    enabled: repo !== null,
  })

  return {
    technologies: query.data?.technologies ?? EMPTY,
    isDetecting: repo !== null && query.isFetching,
  }
}
