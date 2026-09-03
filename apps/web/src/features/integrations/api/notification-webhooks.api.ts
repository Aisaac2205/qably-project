import type {
  NotificationEventType,
  NotificationWebhook,
  NotificationWebhookType,
} from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateNotificationWebhookPayload {
  type: NotificationWebhookType
  name: string
  url: string
  eventTypes: NotificationEventType[]
}

export interface UpdateNotificationWebhookPayload {
  name?: string
  enabled?: boolean
  eventTypes?: NotificationEventType[]
}

export function listNotificationWebhooks(
  signal?: AbortSignal,
): Promise<NotificationWebhook[]> {
  return apiRequest<NotificationWebhook[]>('/notification-webhooks', { signal })
}

export function createNotificationWebhook(
  payload: CreateNotificationWebhookPayload,
): Promise<NotificationWebhook> {
  return apiRequest<NotificationWebhook>('/notification-webhooks', {
    method: 'POST',
    body: payload,
  })
}

export function updateNotificationWebhook(
  id: string,
  payload: UpdateNotificationWebhookPayload,
): Promise<NotificationWebhook> {
  return apiRequest<NotificationWebhook>(`/notification-webhooks/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteNotificationWebhook(id: string): Promise<void> {
  return apiRequest<void>(`/notification-webhooks/${id}`, { method: 'DELETE' })
}

export function testNotificationWebhook(id: string): Promise<void> {
  return apiRequest<void>(`/notification-webhooks/${id}/test`, {
    method: 'POST',
  })
}
