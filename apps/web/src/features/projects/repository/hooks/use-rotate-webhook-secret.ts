'use client'

import { useMutation } from '@tanstack/react-query'
import { rotateWebhookSecret } from '../api/repository.api'

export function useRotateWebhookSecret(projectId: string) {
  return useMutation({
    mutationFn: () => rotateWebhookSecret(projectId),
  })
}
