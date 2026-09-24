'use client'

import { useQuery } from '@tanstack/react-query'
import type { OrgMember } from '@qably/types'
import { listMembers } from '../api/members.api'
import { memberKeys } from '../lib/query-keys'

const EMPTY: OrgMember[] = []

export function useMembers(enabled: boolean) {
  const query = useQuery({
    queryKey: memberKeys.all,
    queryFn: ({ signal }) => listMembers(signal),
    enabled,
  })

  return {
    members: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
