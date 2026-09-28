'use client'

import { useMutation } from '@tanstack/react-query'
import { rotateWebhookSecret } from '@/features/projects/repository/api/repository.api'

export function useRotateSigningKey(projectId: string) {
  return useMutation({
    mutationFn: () => rotateWebhookSecret(projectId),
  })
}
