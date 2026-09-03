import type { Notification, NotificationChannel, NotificationEventType } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface UpdateNotificationPreferencesPayload {
  locale?: 'en' | 'es'
  preferences: Array<{
    eventType: NotificationEventType
    channel: NotificationChannel
    enabled: boolean
  }>
}

export interface NotificationPreferenceView {
  id: string
  userId: string
  organizationId: string
  eventType: NotificationEventType
  channel: NotificationChannel
  enabled: boolean
}

export function listNotifications(signal?: AbortSignal): Promise<Notification[]> {
  return apiRequest<Notification[]>('/notifications', { signal })
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'PATCH' })
}

export function getNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferenceView[]> {
  return apiRequest<NotificationPreferenceView[]>('/notifications/preferences', { signal })
}

export function updateNotificationPreferences(
  payload: UpdateNotificationPreferencesPayload,
): Promise<NotificationPreferenceView[]> {
  return apiRequest<NotificationPreferenceView[]>('/notifications/preferences', {
    method: 'PUT',
    body: payload,
  })
}
