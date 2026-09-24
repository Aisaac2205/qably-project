'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInvite,
  resendInvite,
  revokeInvite,
  type CreateInvitePayload,
} from '../api/invites.api'
import { inviteKeys } from '../lib/query-keys'
import { ApiError } from '@/lib/api-client'

export type InviteErrorCode = 'forbidden' | 'not-found' | 'seat-limit-reached' | 'already-member' | 'error'

function classifyInviteError(error: unknown): InviteErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'forbidden':
      case 'not-found':
      case 'seat-limit-reached':
      case 'already-member':
        return error.code
    }
  }
  return 'error'
}

export function useCreateInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateInvitePayload) => createInvite(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.all })
    },
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inviteKeys.all })
    },
  })
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (inviteId: string) => resendInvite(inviteId),
  })
}

export { classifyInviteError }
