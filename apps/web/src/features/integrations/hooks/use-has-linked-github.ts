'use client'

import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { connectionKeys } from '../lib/query-keys'

export function useHasLinkedGithub() {
  const query = useQuery({
    queryKey: connectionKeys.linkedGithubAccount,
    queryFn: async () => {
      const { data } = await authClient.listAccounts()

      return (data ?? []).some((account) => account.providerId === 'github')
    },
  })

  return {
    hasLinkedGithub: query.data ?? null,
    isLoading: query.isLoading,
  }
}
