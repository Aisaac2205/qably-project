'use client'

import { useMutation } from '@tanstack/react-query'
import { acceptInvite } from '../api/invites.api'

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
  })
}
