'use client'

import { useQuery } from '@tanstack/react-query'
import { listInvites, type OrgInviteSummary } from '../api/invites.api'
import { inviteKeys } from '../lib/query-keys'

const EMPTY: OrgInviteSummary[] = []

export function useInvites(enabled: boolean) {
  const query = useQuery({
    queryKey: inviteKeys.all,
    queryFn: ({ signal }) => listInvites(signal),
    enabled,
  })

  return {
    invites: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
