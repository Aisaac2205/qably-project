'use client'

import { useQuery } from '@tanstack/react-query'
import type { NotificationWebhook } from '@qably/types'
import { listNotificationWebhooks } from '../api/notification-webhooks.api'
import { notificationWebhookKeys } from '../lib/notification-webhook-keys'

const EMPTY: NotificationWebhook[] = []

export function useNotificationWebhooks() {
  const query = useQuery({
    queryKey: notificationWebhookKeys.all,
    queryFn: ({ signal }) => listNotificationWebhooks(signal),
  })

  return {
    webhooks: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
