'use client'

import { useSyncExternalStore } from 'react'
import { getNotifications, getServerNotifications, markNotificationAsRead, subscribe } from '@/lib/mock-store'

export function useNotifications() {
  const notifications = useSyncExternalStore(subscribe, getNotifications, getServerNotifications)
  const unreadCount = notifications.filter((notification) => !notification.readAt).length

  return { notifications, unreadCount, markAsRead: markNotificationAsRead }
}
