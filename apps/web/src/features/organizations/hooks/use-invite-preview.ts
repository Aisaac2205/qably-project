'use client'

import { useQuery } from '@tanstack/react-query'
import { previewInvite } from '../api/invites.api'

export function useInvitePreview(token: string) {
  const query = useQuery({
    queryKey: ['invites', 'preview', token] as const,
    queryFn: () => previewInvite(token),
    retry: false,
  })

  return {
    preview: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
