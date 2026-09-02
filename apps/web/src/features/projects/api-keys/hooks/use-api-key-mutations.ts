'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createApiKey,
  revokeApiKey,
  type CreateApiKeyPayload,
} from '../api/api-keys.api'
import { apiKeyKeys } from '../lib/query-keys'

export function useCreateApiKey(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => createApiKey(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(projectId) })
    },
  })
}

export function useRevokeApiKey(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(projectId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(projectId) })
    },
  })
}
