'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createNotificationWebhook,
  deleteNotificationWebhook,
  testNotificationWebhook,
  updateNotificationWebhook,
  type CreateNotificationWebhookPayload,
  type UpdateNotificationWebhookPayload,
} from '../api/notification-webhooks.api'
import { notificationWebhookKeys } from '../lib/notification-webhook-keys'
import { ApiError } from '@/lib/api-client'

export type WebhookErrorCode = 'plan-limit-reached' | 'error'

export function classifyWebhookError(error: unknown): WebhookErrorCode {
  if (error instanceof ApiError && error.code === 'plan-limit-reached') {
    return error.code
  }
  return 'error'
}

export function useCreateNotificationWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateNotificationWebhookPayload) =>
      createNotificationWebhook(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationWebhookKeys.all })
    },
  })
}

export function useUpdateNotificationWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateNotificationWebhookPayload
    }) => updateNotificationWebhook(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationWebhookKeys.all })
    },
  })
}

export function useDeleteNotificationWebhook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteNotificationWebhook(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationWebhookKeys.all })
    },
  })
}

export function useTestNotificationWebhook() {
  return useMutation({
    mutationFn: (id: string) => testNotificationWebhook(id),
  })
}
