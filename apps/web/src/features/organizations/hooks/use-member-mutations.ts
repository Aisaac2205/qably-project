'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrgRole } from '@qably/types'
import { changeMemberRole, removeMember } from '../api/members.api'
import { memberKeys } from '../lib/query-keys'
import { ApiError } from '@/lib/api-client'

export type MemberErrorCode = 'forbidden' | 'not-found' | 'last-owner-required' | 'error'

function classifyMemberError(error: unknown): MemberErrorCode {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'forbidden':
      case 'not-found':
      case 'last-owner-required':
        return error.code
    }
  }
  return 'error'
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      changeMemberRole(memberId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}

export { classifyMemberError }
